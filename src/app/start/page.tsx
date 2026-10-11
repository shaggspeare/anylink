"use client";

import { Icon } from "@/components/icon";
import { useEffect, useMemo, useRef, useState } from "react";
import { Logo } from "@/components/logo";
import { AmbientOrbs } from "@/components/ambient-orbs";
import { CollectionMarker } from "@/components/collection-marker";
import { mergeImports, parseImportBytes, parseText, type ImportedLink } from "@/lib/import/parse";
import { useLibrary } from "@/lib/store";
import type { GroupedResult } from "@/lib/db/actions";
import type { LinkItem } from "@/lib/types";

/** Import → dead-link sweep → a few questions → collections. The whole v1 wedge:
 * a user arrives with a pile of links somewhere else and leaves with a library. */

type Step = "upload" | "checking" | "questions" | "grouping" | "results";
type DeadLink = { id: string; url: string; title: string; status: number };
type Verdict = "keep" | "kill";

const STEPS: { id: Step; label: string }[] = [
  { id: "upload", label: "Import" },
  { id: "checking", label: "Clean" },
  { id: "questions", label: "Calibrate" },
  { id: "results", label: "Collections" },
];

export default function StartPage() {
  const [step, setStep] = useState<Step>("upload");

  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">
      <AmbientOrbs variant="library" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-[760px] flex-col gap-7 px-4 py-10 sm:py-16">
        <Header step={step} />
        {step === "upload" && <Upload onDone={() => setStep("checking")} />}
        {step === "checking" && <Checking onDone={() => setStep("questions")} />}
        {step === "questions" && <Questions onDone={() => setStep("grouping")} />}
        {(step === "grouping" || step === "results") && (
          <Results grouping={step === "grouping"} onDone={() => setStep("results")} />
        )}
      </div>
    </div>
  );
}

function Header({ step }: { step: Step }) {
  // "grouping" has no chip of its own — it's the wait before the last one.
  const current = Math.max(0, STEPS.findIndex((s) => s.id === (step === "grouping" ? "results" : step)));

  return (
    <div className="flex flex-col gap-5">
      <span className="flex items-center gap-2 self-start text-eyebrow text-ink/50">
        <Logo className="h-11 w-11 sm:h-9 sm:w-9" />
        AnyLink
      </span>
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex flex-1 flex-col gap-1.5">
            <div
              className="h-[3px] rounded-full transition-colors"
              style={{ background: i <= current ? "var(--ink)" : "var(--ink-6)" }}
            />
            <span className={`text-meta ${i <= current ? "text-ink/60" : "text-ink/25"}`}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass-55 flex flex-col gap-5 rounded-[27px] p-6 sm:p-7">{children}</div>
  );
}

function Title({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="text-title">{children}</h1>
      {sub && <p className="text-lead text-ink/55">{sub}</p>}
    </div>
  );
}

const PRIMARY =
  "flex h-12 items-center justify-center rounded-full bg-ink px-6 text-body font-semibold text-on-ink disabled:opacity-40";

// ——————————————————————————————————————————— 1. Import

type SourceId = ImportedLink["source"];

/** Where each export comes from and how to get it. A tile names the source; picking it
 * shows the steps, because the hard part of importing is finding the export button. */
const SOURCES: { id: SourceId; name: string; blurb: string; where: string; steps: string[]; note: string }[] = [
  {
    id: "safari",
    name: "Safari",
    blurb: "Bookmarks and folders",
    where: "iPhone or Mac",
    steps: [
      "iPhone (iOS 18.2+): Settings → Apps → Safari → Export → tick Bookmarks → Save to Downloads.",
      "Mac: Safari → File → Export Browsing Data to File.",
      "Choose the “Safari Export” zip as it is — there's nothing to unzip.",
    ],
    note: "Only bookmarks are read, and their folders help build your collections. Leave passwords and cards unticked anyway.",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    blurb: "Links from a chat",
    where: "phone",
    steps: ["Open the chat → tap its name at the top.", "Export Chat → Without Media.", "Choose the zip (iPhone) or .txt (Android)."],
    note: "The message around each link is kept as context. In a group chat, links other people sent come in too.",
  },
  {
    id: "text",
    name: "Text with links",
    blurb: "Paste from anywhere",
    where: "anywhere",
    steps: ["Copy the text — notes, an email, a list.", "Paste it below."],
    note: "Only links starting with http or www are picked out. The line each one is on is kept as context.",
  },
  {
    id: "chrome",
    name: "Chrome, Firefox, Edge",
    blurb: "HTML bookmarks file",
    where: "computer",
    steps: ["Open the bookmark manager.", "Export bookmarks → an HTML file.", "Choose that file."],
    note: "Their phone apps can't export bookmarks — it has to be the computer.",
  },
  {
    id: "telegram",
    name: "Telegram",
    blurb: "Saved Messages",
    where: "Telegram Desktop",
    steps: [
      "Install Telegram Desktop from desktop.telegram.org.",
      "Saved Messages → ⋮ → Export chat history.",
      "Untick photos and files, format: Machine-readable JSON.",
      "Choose result.json.",
    ],
    note: "The phone apps can't export, and neither can the Mac App Store “Telegram” — only Telegram Desktop. A new desktop login waits 24 hours before it can export, unless you approve the request on your phone. Only Saved Messages is read.",
  },
];

function Upload({ onDone }: { onDone: () => void }) {
  const { importLinks } = useLibrary();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<SourceId | null>(null);
  const [fileItems, setFileItems] = useState<ImportedLink[]>([]);
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Files first, so a URL in both keeps its folder or message.
  const items = useMemo(() => mergeImports([fileItems, parseText(pasted)]), [fileItems, pasted]);
  const source = SOURCES.find((s) => s.id === open);

  const handleFiles = async (files: FileList) => {
    setError("");
    try {
      const parsed = await Promise.all(
        [...files].map(async (file) => parseImportBytes(file.name, new Uint8Array(await file.arrayBuffer())))
      );
      const merged = mergeImports(parsed);
      if (merged.length === 0) {
        setError("No links in that file. Check it's the export the steps describe.");
        return;
      }
      // Sources are picked one at a time, so each file adds to what's there.
      setFileItems((prev) => mergeImports([prev, merged]));
      setOpen(null);
    } catch {
      setError("Couldn't read that file. Choose the export itself — the zip, HTML, result.json or .txt the steps make.");
    }
  };

  const remove = (id: SourceId) => {
    if (id === "text") setPasted("");
    else setFileItems((prev) => prev.filter((item) => item.source !== id));
  };

  const counts = useMemo(() => {
    const bySource = new Map<SourceId, number>();
    for (const item of items) bySource.set(item.source, (bySource.get(item.source) ?? 0) + 1);
    return bySource;
  }, [items]);

  const runImport = async () => {
    if (items.length === 0) return;
    setBusy(true);
    try {
      await importLinks(items);
      onDone();
    } catch {
      setError("The import didn't go through. Nothing was saved — try again.");
      setBusy(false);
    }
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
      }}
    >
      <Panel>
        <Title sub="Pick where your links are. Nothing is uploaded anywhere except your own library.">
          Bring your links
        </Title>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {SOURCES.map((s) => {
            const n = counts.get(s.id);
            return (
              <button
                key={s.id}
                type="button"
                aria-expanded={open === s.id}
                onClick={() => setOpen(open === s.id ? null : s.id)}
                className={`flex min-h-[104px] flex-col items-start justify-between gap-3 rounded-[18px] bg-surface/60 p-4 text-left transition-shadow ${
                  open === s.id || n ? "ring-2 ring-ink" : "hover:ring-1 hover:ring-ink/20"
                }`}
              >
                <span className="text-meta text-ink/40">{s.where}</span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-semibold">{s.name}</span>
                  <span className="text-meta text-ink/55">{n ? `✓ ${n} links` : s.blurb}</span>
                </span>
              </button>
            );
          })}
        </div>

        {source && (
          <div className="flex flex-col gap-4 rounded-[22px] border border-dashed border-ink/20 px-6 py-6">
            <div className="text-[15px] font-semibold">{source.name}</div>
            <ol className="flex flex-col gap-2 text-[13.5px] leading-[1.55] text-ink/75">
              {source.steps.map((step, i) => (
                <li key={step} className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-on-ink">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <p className="text-[13px] leading-[1.6] text-ink/50">{source.note}</p>
            {source.id === "text" ? (
              <textarea
                autoFocus
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={5}
                placeholder="https://… one per line, or buried in a paragraph"
                className="rounded-[14px] border border-rim/80 bg-surface/70 px-4 py-3 text-body outline-none placeholder:text-ink/30"
              />
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="self-start rounded-full bg-signal px-5 py-2.5 text-[13px] font-semibold text-on-accent"
              >
                Choose file…
              </button>
            )}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".html,.htm,.json,.zip,.txt"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {error && <p className="text-[13px] text-signal">{error}</p>}

        {items.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[15px] font-semibold">{items.length} links found</span>
            {[...counts.entries()].map(([id, n]) => (
              <span key={id} className="flex items-center gap-1.5 rounded-full bg-ink/6 py-1 pl-3 pr-1.5 text-meta text-ink/60">
                {n} from {SOURCES.find((s) => s.id === id)?.name ?? id}
                <button
                  type="button"
                  onClick={() => remove(id)}
                  aria-label={`Remove links from ${SOURCES.find((s) => s.id === id)?.name ?? id}`}
                  className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-ink/10"
                >
                  <Icon name="close" size={9} />
                </button>
              </span>
            ))}
          </div>
        )}

        <button type="button" onClick={runImport} disabled={items.length === 0 || busy} className={PRIMARY}>
          {busy ? "Importing…" : items.length > 0 ? `Import ${items.length} links` : "Pick a source to import"}
        </button>
      </Panel>
    </div>
  );
}

// ——————————————————————————————————————————— 2. Dead-link sweep

function Checking({ onDone }: { onDone: () => void }) {
  const { deleteLinks, logSignal } = useLibrary();
  const started = useRef(false);
  const [done, setDone] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [dead, setDead] = useState<DeadLink[]>([]);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    // Effects run twice in development, so the run is guarded by a ref — and
    // deliberately has no cleanup: a cleanup would cancel the first pass while the
    // ref blocks the second, leaving nothing running at all. Checks write to the
    // database as they land, so letting one finish after a navigation is harmless.
    if (started.current) return;
    started.current = true;

    (async () => {
      let left = 1;
      let checked = 0;
      // The route caps each request so it can't be killed by a function timeout —
      // whatever it didn't get to comes back as `remaining`, so we just go again.
      while (left > 0) {
        const res = await fetch("/api/import/check", { method: "POST" });
        if (!res.body) break;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const base = checked;

        for (;;) {
          const { done: streamDone, value } = await reader.read();
          if (streamDone) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const msg = JSON.parse(line);
            if (msg.type === "progress") {
              checked = base + msg.checked;
              setDone(checked);
            } else if (msg.type === "done") {
              left = msg.remaining ?? 0;
              checked = base + msg.checked;
              setDone(checked);
              setRemaining(left);
              setDead((prev) => [...prev, ...(msg.dead ?? [])]);
            } else if (msg.type === "failed") {
              left = 0;
            }
          }
        }
      }
      setFinished(true);
    })();
  }, []);

  const total = done + remaining;
  const removeDead = () => {
    const ids = dead.map((d) => d.id);
    deleteLinks(ids);
    for (const link of dead) logSignal("remove-dead", { linkId: link.id, payload: { status: link.status } });
    onDone();
  };

  return (
    <Panel>
      <Title sub="Every link gets a request. Anything that 404s, times out or has turned into a parked domain is flagged.">
        Checking what still exists
      </Title>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-3">
          <span className="text-[15px] font-semibold">{finished ? "Done" : "Checking…"}</span>
          <span className="ml-auto font-mono text-[13px] font-semibold tabular-nums text-ink/60">
            {done}/{total || "…"}
          </span>
        </div>
        <div className="h-[5px] overflow-hidden rounded-full bg-ink/6">
          <div
            className="h-full rounded-full bg-lime transition-[width] duration-300"
            style={{ width: total > 0 ? `${(done / total) * 100}%` : "6%" }}
          />
        </div>
      </div>

      {dead.length > 0 && (
        <div className="flex max-h-[220px] flex-col gap-1.5 overflow-y-auto rounded-[18px] bg-ink/4 p-4">
          {dead.slice(0, 40).map((link) => (
            <div key={link.id} className="flex items-center gap-2.5 text-[12.5px]">
              <span className="font-mono text-[11px] text-signal">
                {link.status === 0 ? "gone" : link.status === 1 ? "parked" : link.status}
              </span>
              <span className="truncate text-ink/55">{link.title}</span>
            </div>
          ))}
          {dead.length > 40 && (
            <span className="text-meta text-ink/45">and {dead.length - 40} more</span>
          )}
        </div>
      )}

      {finished && (
        <div className="flex flex-col gap-3">
          <p className="text-lead text-ink/60">
            {dead.length === 0
              ? "Every link answered. Nothing to clean up."
              : `${dead.length} of ${total} are dead. They go to Trash, not the void — restore any of them later.`}
          </p>
          <div className="flex flex-wrap gap-2.5">
            <button type="button" onClick={dead.length > 0 ? removeDead : onDone} className={PRIMARY}>
              {dead.length > 0 ? `Remove ${dead.length} dead links` : "Next"}
            </button>
            {dead.length > 0 && (
              <button
                type="button"
                onClick={onDone}
                className="flex h-12 items-center rounded-full bg-ink/6 px-5 text-body font-semibold text-ink/60"
              >
                Keep them for now
              </button>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}

// ——————————————————————————————————————————— 3. Calibration

/** Answers stay on the window between steps rather than in a store: they're read once,
 * by the grouping call on the very next screen. */
let pendingPriorities: import("@/lib/rank/group-links").Priorities | null = null;

function Questions({ onDone }: { onDone: () => void }) {
  const { links, deleteLinks, logSignal } = useLibrary();
  const [focus, setFocus] = useState("");
  const [avoid, setAvoid] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});

  // Suggested topics come from what they actually imported — their own folder names and
  // the sites they save from — so there's nothing to type and nothing generic to pick.
  const suggested = useMemo(() => suggestTopics(links), [links]);
  const sample = useMemo(() => sampleLinks(links, 8), [links]);

  const submit = () => {
    const killed = sample.filter((l) => verdicts[l.id] === "kill");
    const kept = sample.filter((l) => verdicts[l.id] === "keep");
    for (const link of [...kept, ...killed]) {
      logSignal(verdicts[link.id], { linkId: link.id, payload: { title: link.title } });
    }
    if (killed.length > 0) deleteLinks(killed.map((l) => l.id));

    pendingPriorities = {
      focus: focus.trim(),
      topics,
      kept: kept.map((l) => l.title),
      killed: killed.map((l) => l.title),
      avoid: avoid.trim(),
    };
    onDone();
  };

  return (
    <Panel>
      <Title sub="Four quick answers. This is what your collections get built against — not a profile, just what matters this month.">
        What are you keeping links for?
      </Title>

      <label className="flex flex-col gap-2">
        <span className="text-eyebrow text-ink/50">What are you working on right now?</span>
        <input
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          placeholder="Rewriting the onboarding, learning Rust, planning a kitchen…"
          className="h-[46px] rounded-[14px] border border-rim/80 bg-surface/70 px-4 text-body outline-none placeholder:text-ink/30"
        />
      </label>

      {suggested.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-eyebrow text-ink/50">Which of these still interest you?</span>
          <div className="flex flex-wrap gap-2">
            {suggested.map((topic) => {
              const on = topics.includes(topic);
              return (
                <button
                  key={topic}
                  type="button"
                  onClick={() =>
                    setTopics((prev) => (on ? prev.filter((t) => t !== topic) : [...prev, topic]))
                  }
                  className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                    on ? "bg-ink text-on-ink" : "bg-ink/6 text-ink/60"
                  }`}
                >
                  {topic}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {sample.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-eyebrow text-ink/50">Keep or bin? ({Object.keys(verdicts).length}/{sample.length})</span>
          <div className="flex flex-col gap-1.5">
            {sample.map((link) => (
              <div key={link.id} className="flex items-center gap-3 rounded-[14px] bg-surface/60 px-3.5 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body">{link.title}</span>
                  <span className="block truncate text-meta text-ink/45">{link.domain}</span>
                </span>
                {(["keep", "kill"] as Verdict[]).map((verdict) => (
                  <button
                    key={verdict}
                    type="button"
                    onClick={() => setVerdicts((prev) => ({ ...prev, [link.id]: verdict }))}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                      verdicts[link.id] === verdict
                        ? verdict === "keep"
                          ? "bg-lime text-on-accent"
                          : "bg-ink text-on-ink"
                        : "bg-ink/6 text-ink/50"
                    }`}
                  >
                    {verdict === "keep" ? "Keep" : "Bin"}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <label className="flex flex-col gap-2">
        <span className="text-eyebrow text-ink/50">{"Anything you'd rather never see again?"}</span>
        <input
          value={avoid}
          onChange={(e) => setAvoid(e.target.value)}
          placeholder="Old job stuff, crypto, recipes I'll never cook…"
          className="h-[46px] rounded-[14px] border border-rim/80 bg-surface/70 px-4 text-body outline-none placeholder:text-ink/30"
        />
      </label>

      <button type="button" onClick={submit} className={PRIMARY}>
        Build my collections
      </button>
    </Panel>
  );
}

/** The deepest bookmark folder is the specific one, and a site somebody saved from ten
 * times is a topic whether or not they'd have named it. Both beat a hardcoded list. */
function suggestTopics(links: LinkItem[], limit = 12): string[] {
  const counts = new Map<string, number>();
  for (const link of links) {
    const folder = link.importMeta?.folder?.split("/").pop()?.trim();
    const key = folder || link.domain;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name]) => name);
}

/** Spread the sample across sites — eight links from the same domain would calibrate
 * nothing. Biggest domains first, one each, then round again if there's room. */
function sampleLinks(links: LinkItem[], count: number): LinkItem[] {
  const byDomain = new Map<string, LinkItem[]>();
  for (const link of links) byDomain.set(link.domain, [...(byDomain.get(link.domain) ?? []), link]);
  const queues = [...byDomain.values()].sort((a, b) => b.length - a.length);

  const picked: LinkItem[] = [];
  for (let round = 0; picked.length < count && queues.some((q) => q.length > round); round++) {
    for (const queue of queues) {
      if (picked.length >= count) break;
      if (queue[round]) picked.push(queue[round]);
    }
  }
  return picked;
}

// ——————————————————————————————————————————— 4. Collections

function Results({ grouping, onDone }: { grouping: boolean; onDone: () => void }) {
  const { groupInbox, moveLinks, deleteCollection, logSignal, inbox } = useLibrary();
  const started = useRef(false);
  const [results, setResults] = useState<GroupedResult[]>([]);
  const [verdicts, setVerdicts] = useState<Record<string, "up" | "down">>({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    groupInbox(pendingPriorities ?? { focus: "", topics: [], kept: [], killed: [], avoid: "" })
      .then((grouped) => {
        setResults(grouped);
        onDone();
      })
      .catch(() => {
        setFailed(true);
        onDone();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reject = async (result: GroupedResult) => {
    setVerdicts((prev) => ({ ...prev, [result.collection.id]: "down" }));
    logSignal("reject", {
      collectionId: result.collection.id,
      payload: { name: result.collection.name, links: result.linkIds.length },
    });
    // Put the links back where they came from, then drop the empty collection — so a
    // rejected group is actually undone, not just noted.
    if (inbox) moveLinks(result.linkIds, inbox.id);
    await deleteCollection(result.collection.id);
    setResults((prev) => prev.filter((r) => r.collection.id !== result.collection.id));
  };

  const accept = (result: GroupedResult) => {
    setVerdicts((prev) => ({ ...prev, [result.collection.id]: "up" }));
    logSignal("accept", {
      collectionId: result.collection.id,
      payload: { name: result.collection.name, links: result.linkIds.length },
    });
  };

  if (grouping) {
    return (
      <Panel>
        <Title sub="Reading every title against what you just told us. About twenty seconds.">
          Building your collections
        </Title>
        <div className="h-[5px] overflow-hidden rounded-full bg-ink/6">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-signal" />
        </div>
      </Panel>
    );
  }

  return (
    <>
      <Panel>
        <Title
          sub={
            failed || results.length === 0
              ? "Nothing to group — everything is either filed already or in the trash."
              : "Each one says why it exists. Bin the ones that miss; those links go back to Unsorted and the choice is remembered."
          }
        >
          {results.length > 0 ? `${results.length} collections` : "All done"}
        </Title>

        <div className="flex flex-col gap-2.5">
          {results.map((result) => (
            <div
              key={result.collection.id}
              className="flex flex-col gap-2.5 rounded-[18px] bg-surface/60 p-4"
              style={{ opacity: verdicts[result.collection.id] === "up" ? 1 : undefined }}
            >
              <div className="flex items-center gap-2.5">
                <CollectionMarker color={result.collection.color} />
                <span className="text-[15px] font-semibold">{result.collection.name}</span>
                <span className="text-meta text-ink/45">{result.linkIds.length} links</span>
                <div className="ml-auto flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => accept(result)}
                    aria-label={`Keep ${result.collection.name}`}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] ${
                      verdicts[result.collection.id] === "up" ? "bg-lime" : "bg-ink/6 text-ink/50"
                    }`}
                  >
                    <Icon name="check" size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => reject(result)}
                    aria-label={`Bin ${result.collection.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/6 text-[13px] text-ink/50"
                  >
                    <Icon name="close" size={12} />
                  </button>
                </div>
              </div>
              {result.reasoning && (
                <p className="text-[13px] leading-[1.55] text-ink/55">{result.reasoning}</p>
              )}
            </div>
          ))}
        </div>

        {/* A full page load, not a client navigation: the store was seeded once, so a
            soft navigation would keep showing pre-check link health. Reloading re-reads
            every link from Postgres, which is the cheapest way to end up consistent. */}
        <a href="/app" className={PRIMARY}>
          Open my library
        </a>
      </Panel>
    </>
  );
}
