// explicit extension so `node --test` can load this file's pure helpers
import { chatJson } from "../llm.ts";

/** Turns a pile of imported links into a handful of named, ranked collections, scored
 * against what the user said they care about in onboarding.
 *
 * One call per batch of links rather than one per link: the whole point is deciding
 * what belongs *together*, which a per-link call can't see. */

export type Priorities = {
  /** "What are you working on right now?" */
  focus: string;
  /** Topics picked from what their own import actually contains. */
  topics: string[];
  /** Titles they kept and killed in the sample — the strongest signal in here. */
  kept: string[];
  killed: string[];
  /** "Anything you'd rather never see again?" */
  avoid: string;
};

export type GroupInput = {
  /** Index into the caller's array. Sent instead of a uuid: shorter, and there's
   * nothing for the model to hallucinate. */
  i: number;
  title: string;
  domain: string;
  /** Bookmark folder or Telegram message text, when the export had one. */
  note?: string;
};

export type GroupedCollection = {
  name: string;
  reasoning: string;
  /** Indices back into the `GroupInput[]` that was passed in. */
  indices: number[];
  /** 1 = closest to what the user said matters. */
  rank: number;
};

/** Links per call. Big enough to see themes, small enough that the model still reads
 * every line and the response fits comfortably in the token budget. */
const BATCH = 75;
/** ponytail: a ceiling on cost and wall-clock, not a technical limit. Anything past
 * this stays in the inbox and can be grouped in a second pass. */
const MAX_BATCHES = 8;

const SYSTEM_PROMPT = `You are triaging a person's saved links into a few collections they'd actually open.

You get their stated priorities and a numbered list of links (title, domain, and sometimes
the bookmark folder or the note they saved it with). Return strict JSON:
{
  "collections": [
    {
      "name": string (2-4 words, concrete and specific to the content — "Rust async" not
        "Programming", "Kitchen renovation" not "Home". Never name it after the source
        or the file it came from),
      "reasoning": string (one sentence, addressed to the user, saying what these have in
        common and why it matters to them given their priorities — this is shown in the UI),
      "indices": number[] (the links that belong here),
      "rank": number (1 = most relevant to their stated priorities, ascending)
    }
  ]
}
Rules:
- 3 to 6 collections. Fewer, fuller collections beat many thin ones.
- Every link goes in exactly one collection. Never drop one, never repeat one.
- Links that match nothing they care about still need a home: put them in one honest
  low-rank collection (name it for what it is, e.g. "Old signups" or "Random reading").
- Anything matching what they said they want to avoid goes to the lowest rank.
- Judge by the link itself, not by how many share a domain. A folder of 40 links from one
  site is still one topic; 3 links about their current project outrank all 40.
Return ONLY the JSON object.`;

type Response = { collections?: Partial<GroupedCollection>[] };

/** Groups every link, in batches. The first batch sets the vocabulary and the rest run
 * in parallel against it — so a 600-link import costs two round trips of latency rather
 * than eight, without every batch inventing its own name for the same theme. */
export async function groupLinks(
  links: GroupInput[],
  priorities: Priorities
): Promise<GroupedCollection[] | null> {
  const batches: GroupInput[][] = [];
  for (let i = 0; i < links.length && batches.length < MAX_BATCHES; i += BATCH) {
    batches.push(links.slice(i, i + BATCH));
  }
  if (batches.length === 0) return [];

  const first = await callBatch(batches[0], priorities, []);
  if (!first) return null;

  const names = first.map((c) => c.name);
  const rest = await Promise.all(
    batches.slice(1).map((batch) => callBatch(batch, priorities, names))
  );

  return merge([first, ...rest.filter((r): r is GroupedCollection[] => r !== null)]);
}

async function callBatch(
  batch: GroupInput[],
  priorities: Priorities,
  existingNames: string[]
): Promise<GroupedCollection[] | null> {
  const parsed = await chatJson<Response>(
    SYSTEM_PROMPT,
    {
      priorities,
      existingCollections:
        existingNames.length > 0
          ? `Reuse these names verbatim where a link fits one; only invent a name when none do: ${existingNames.join(", ")}`
          : undefined,
      links: batch,
    },
    { maxTokens: 4000, timeoutMs: 60_000 }
  );

  const collections = parsed?.collections;
  if (!Array.isArray(collections)) return null;

  const valid = new Set(batch.map((l) => l.i));
  const claimed = new Set<number>();
  const cleaned: GroupedCollection[] = [];

  for (const collection of collections) {
    // A hallucinated index, or one already placed, would silently duplicate or misfile
    // a link — drop those rather than trusting the response.
    const indices = (Array.isArray(collection.indices) ? collection.indices : []).filter(
      (i): i is number => typeof i === "number" && valid.has(i) && !claimed.has(i)
    );
    for (const i of indices) claimed.add(i);
    if (indices.length === 0 || typeof collection.name !== "string" || !collection.name.trim()) {
      continue;
    }
    cleaned.push({
      name: collection.name.trim().slice(0, 60),
      reasoning: typeof collection.reasoning === "string" ? collection.reasoning.trim() : "",
      indices,
      rank: typeof collection.rank === "number" ? collection.rank : 99,
    });
  }

  // Whatever the model forgot still has to land somewhere.
  const missed = batch.map((l) => l.i).filter((i) => !claimed.has(i));
  if (missed.length > 0) {
    cleaned.push({
      name: "Everything else",
      reasoning: "Didn't fit any of the themes in the rest of your library.",
      indices: missed,
      rank: 99,
    });
  }

  return cleaned;
}

/** No model available (no key, API down, unparseable answer) and the import still has to
 * come out the other side grouped. The export file's own structure is the next best
 * signal: the folder the user filed it in, or failing that the site it came from. */
export function groupByMetadata(links: GroupInput[]): GroupedCollection[] {
  const MIN_GROUP = 3;
  const buckets = new Map<string, number[]>();

  for (const link of links) {
    // The deepest folder is the specific one — "Bookmarks bar / Reading / Rust" is a
    // collection called Rust, not one called Bookmarks bar.
    const key = link.note?.split("/").pop()?.trim() || link.domain;
    buckets.set(key, [...(buckets.get(key) ?? []), link.i]);
  }

  const collections: GroupedCollection[] = [];
  const leftovers: number[] = [];
  for (const [name, indices] of buckets) {
    if (indices.length >= MIN_GROUP) {
      collections.push({
        name,
        reasoning: `Grouped because ${indices.length} links came from the same place.`,
        indices,
        rank: 50,
      });
    } else {
      leftovers.push(...indices);
    }
  }

  collections.sort((a, b) => b.indices.length - a.indices.length);
  if (leftovers.length > 0) {
    collections.push({
      name: "Everything else",
      reasoning: "Too few links from anywhere in particular to make a collection of.",
      indices: leftovers,
      rank: 99,
    });
  }
  return collections;
}

/** Same name from two batches means one collection. Case- and punctuation-insensitive,
 * because that's the drift that actually happens ("Rust async" vs "Rust Async"). */
export function merge(batches: GroupedCollection[][]): GroupedCollection[] {
  const byKey = new Map<string, GroupedCollection>();

  for (const collection of batches.flat()) {
    const key = collection.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const existing = byKey.get(key);
    if (existing) {
      existing.indices.push(...collection.indices);
      existing.rank = Math.min(existing.rank, collection.rank);
    } else {
      byKey.set(key, { ...collection });
    }
  }

  return [...byKey.values()].sort((a, b) => a.rank - b.rank || b.indices.length - a.indices.length);
}
