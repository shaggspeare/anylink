"use client";

import { Icon } from "@/components/icon";
import { useEffect, useRef, useState } from "react";
import { useLibrary } from "@/lib/store";
import { suggestTags } from "@/lib/organize";
import type { CrawlResult, CrawlStep } from "@/lib/crawler";
import { failureFor, type CrawlFailure } from "@/lib/crawler/url";
import { CARD_SIZES, type CardSize, type Collection } from "@/lib/types";
import { AmbientOrbs } from "./ambient-orbs";

type Phase = "idle" | "crawling" | "ready";
type ReadyResult = CrawlResult | CrawlFailure;

// "tags" (the LLM pass) runs after the form is already open — see `refining`.
const STEP_ORDER: CrawlStep[] = ["fetch", "parse"];
const STEP_LABELS: Partial<Record<CrawlStep, string>> = {
  fetch: "Fetching page",
  parse: "Reading content",
};

export function AddLinkFlow() {
  const {
    addLinkOpen,
    addLinkPrefillUrl,
    closeAddLink,
    addLink,
    collections,
    tags: libraryTags,
    inbox,
  } = useLibrary();

  const [phase, setPhase] = useState<Phase>("idle");
  const [url, setUrl] = useState("");
  const [step, setStep] = useState(-1);
  const [result, setResult] = useState<ReadyResult | null>(null);
  const [clipboardHint, setClipboardHint] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  // Defaults to the inbox: filing is a separate, later decision, not a gate on saving.
  const [collectionId, setCollectionId] = useState(inbox?.id ?? "");
  const [size, setSize] = useState<CardSize>("M");
  const [touched, setTouched] = useState<{ collection?: boolean; size?: boolean }>({});
  const [saving, setSaving] = useState(false);
  // Form is open on the parsed preview while the LLM pass is still running.
  const [refining, setRefining] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  // Fields the user has typed into — the LLM result must not overwrite those.
  const editedRef = useRef(new Set<"title" | "excerpt" | "tags">());

  const reset = () => {
    abortRef.current?.abort();
    setPhase("idle");
    setUrl("");
    setStep(-1);
    setResult(null);
    setTitle("");
    setExcerpt("");
    setTags([]);
    setCollectionId(inbox?.id ?? "");
    setSize("M");
    setSaving(false);
    setRefining(false);
    editedRef.current.clear();
    setTouched({});
    setClipboardHint(null);
  };

  const runCrawl = async (targetUrl: string) => {
    setUrl(targetUrl);
    setPhase("crawling");
    setStep(-1);
    setRefining(false);
    editedRef.current.clear();
    let settled = false;

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
        signal: controller.signal,
      });
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line);
          if (msg.type === "step") {
            const i = STEP_ORDER.indexOf(msg.step);
            if (i >= 0) setStep(i);
          } else if (msg.type === "preview" || msg.type === "done") {
            settled = true;
            const edited = editedRef.current;
            setResult(msg.result);
            if (!edited.has("title")) setTitle(msg.result.title);
            if (!edited.has("excerpt")) setExcerpt(msg.result.excerpt);
            // Pre-ticked, not silently applied — the form is where you drop the wrong ones.
            if (!edited.has("tags")) setTags(msg.result.suggestedTags ?? []);
            setRefining(msg.type === "preview");
            setPhase("ready");
          } else if (msg.type === "failed") {
            settled = true;
            const failure: CrawlFailure = msg;
            setResult(failure);
            // Failure is a fill-in state, not an error screen: seed the form with
            // what the URL itself gives away so there's something to correct.
            setTitle(failure.suggestedTitle ?? "");
            setExcerpt("");
            setPhase("ready");
          }
        }
      }
      setRefining(false);
      // Stream cut off before any card arrived (e.g. the function hit its time
      // limit) — without this the form would sit on "crawling" forever.
      if (!settled) throw new Error("network");
    } catch (err) {
      // Aborted = the modal was reset; a newer crawl may already own this state.
      if (controller.signal.aborted) return;
      setRefining(false);
      if (settled) return;
      const failure = failureFor(targetUrl, err instanceof Error ? err.message : "network");
      setResult(failure);
      setTitle(failure.suggestedTitle);
      setPhase("ready");
    }
  };

  useEffect(() => {
    if (!addLinkOpen || !addLinkPrefillUrl) return;
    const kickoff = setTimeout(() => runCrawl(addLinkPrefillUrl), 0);
    return () => clearTimeout(kickoff);
  }, [addLinkOpen, addLinkPrefillUrl]);

  useEffect(() => {
    if (addLinkOpen && phase === "idle" && !addLinkPrefillUrl) {
      navigator.clipboard
        ?.readText()
        .then((text) => {
          if (/^https?:\/\/\S+$/i.test(text.trim())) setClipboardHint(text.trim());
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLinkOpen]);

  if (!addLinkOpen) return null;

  const handleClose = () => {
    closeAddLink();
    reset();
  };

  const handleFetch = () => {
    if (!/^https?:\/\/\S+$/i.test(url.trim())) return;
    runCrawl(url.trim());
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const text = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (/^https?:\/\/\S+$/i.test(text.trim())) {
      setUrl(text.trim());
      runCrawl(text.trim());
    }
  };

  const collectionError = touched.collection && !collectionId;
  const canSave = Boolean(collectionId) && Boolean(size);

  const handleSave = async () => {
    setTouched({ collection: true, size: true });
    if (!canSave || !result || saving) return;
    setSaving(true);
    const crawled = "failed" in result ? null : result;
    await addLink({
      // store what the page calls itself, not what happened to be on the clipboard
      url: crawled?.canonicalUrl ?? url,
      domain: result.domain,
      title: title || result.domain,
      excerpt,
      articleText: crawled?.articleText,
      heroImage: crawled?.heroImage,
      tint: result.tint,
      stripe: result.stripe,
      initial: result.initial,
      contentType: crawled?.contentType ?? "article",
      readingTimeMinutes: crawled?.readingTimeMinutes,
      collectionId,
      tags,
      size,
      product: crawled?.product,
    });
    handleClose();
  };

  const wide = phase === "ready";

  return (
    <div
      className="fixed inset-0 z-50 grid items-end sm:place-items-center sm:p-4"
      style={{ background: "rgba(13,14,16,.42)", backdropFilter: "blur(6px)" }}
      onClick={handleClose}
    >
      <div
        // Phones get a bottom sheet: it sits where the thumb is and the keyboard pushes it up.
        className={`relative max-h-[calc(100dvh-env(safe-area-inset-top)-12px)] w-full overflow-y-auto overscroll-contain rounded-t-[30px] transition-[max-width] sm:max-h-[calc(100dvh-2rem)] sm:rounded-[30px] ${
          wide ? "max-w-3xl" : "max-w-[620px]"
        }`}
        style={{ boxShadow: "var(--shadow-window)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* overflow-clip, not -hidden: hidden would turn this into the scroll box and the
            sticky header and Save button would stop sticking. */}
        <div className="relative min-h-[420px] overflow-clip bg-canvas">
          <AmbientOrbs variant="sheet" />
          <div className="relative flex h-full flex-col">
            <div className="sticky top-0 z-20 flex items-center gap-3 bg-canvas/45 px-6 pb-2 pt-6 backdrop-blur-xl">
              <h3 className="text-title flex-1 text-ink">Add a link</h3>
              <span className="hidden text-eyebrow text-ink/40 pointer-fine:inline">⌘V anywhere</span>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close"
                className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-ink/55 hover:bg-ink/6"
              >
                <Icon name="close" size={12} />
              </button>
            </div>

            <div className="flex flex-wrap gap-2 px-6 pt-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFetch()}
                placeholder="https://"
                disabled={phase !== "idle"}
                className="h-[46px] min-w-0 flex-1 rounded-full border px-4.5 max-sm:basis-full text-[14px] text-ink outline-none disabled:opacity-50"
                style={{ borderColor: "rgb(var(--ink-rgb) / 0.16)", background: "rgb(var(--ink-rgb) / 0.05)" }}
              />
              <button
                type="button"
                onClick={async () => {
                  const text = await navigator.clipboard?.readText().catch(() => "");
                  if (text) setUrl(text.trim());
                }}
                disabled={phase !== "idle"}
                className="h-[46px] rounded-full border px-4.5 text-[13px] max-sm:flex-1 sm:flex-none font-medium text-ink disabled:opacity-50"
                style={{ borderColor: "rgb(var(--ink-rgb) / 0.16)" }}
              >
                Paste
              </button>
              <button
                type="button"
                onClick={handleFetch}
                disabled={phase !== "idle"}
                className="h-[46px] rounded-full bg-signal px-5 text-[13px] max-sm:flex-1 sm:flex-none font-semibold text-on-accent disabled:opacity-50"
              >
                Fetch
              </button>
            </div>

            <div className="flex-1 px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-5">
              {phase === "idle" && (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="flex flex-col items-start gap-3.5 rounded-[22px] border border-dashed px-6.5 py-7.5"
                  style={{ borderColor: "rgb(var(--ink-rgb) / 0.18)" }}
                >
                  <div className="flex h-[46px] w-[46px] items-center justify-center rounded-[14px]" style={{ background: "rgba(255,90,31,.18)" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff8a5c" strokeWidth="2.4" strokeLinecap="round">
                      <path d="M9.5 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
                      <path d="M14.5 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
                    </svg>
                  </div>
                  <div className="text-[18px] font-semibold tracking-[-.035em] text-ink">
                    Nothing to read yet
                  </div>
                  <div className="max-w-[420px] text-[13px] leading-[1.6] text-ink/55">
                    Drop in any URL. The crawler pulls the title, hero image, domain and suggests
                    two or three tags — you only fix what it gets wrong.
                  </div>
                  {clipboardHint && (
                    <button
                      type="button"
                      onClick={() => {
                        setUrl(clipboardHint);
                        runCrawl(clipboardHint);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-[14px] px-4 py-3 text-left text-[12.5px] text-ink/55 hover:text-ink"
                      style={{ background: "rgb(var(--ink-rgb) / 0.05)" }}
                    >
                      <span className="text-signal">On your clipboard</span>
                      <span className="truncate">{clipboardHint}</span>
                    </button>
                  )}
                </div>
              )}

              {phase === "crawling" && (
                <div
                  className="flex flex-col gap-4.5 rounded-[22px] p-6"
                  style={{ background: "rgb(var(--ink-rgb) / 0.05)", border: "1px solid rgb(var(--ink-rgb) / 0.1)" }}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-[15px] font-semibold tracking-[-.03em] text-ink">
                      Reading the page…
                    </div>
                    <div className="ml-auto font-mono text-[13px] font-semibold text-signal tabular-nums">
                      {Math.round(((step + 1) / STEP_ORDER.length) * 100)}%
                    </div>
                  </div>
                  <div className="h-[5px] overflow-hidden rounded-full" style={{ background: "rgb(var(--ink-rgb) / 0.12)" }}>
                    <div
                      className="h-full rounded-full bg-lime transition-[width] duration-500"
                      style={{ width: `${((step + 1) / STEP_ORDER.length) * 100}%` }}
                    />
                  </div>
                  <div className="flex flex-col gap-3">
                    {STEP_ORDER.map((s, i) => (
                      <div
                        key={s}
                        className="flex items-center gap-2.5 text-[13px]"
                        style={{ color: i <= step ? "var(--ink)" : "rgb(var(--ink-rgb) / .4)" }}
                      >
                        <span
                          className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full text-[10px] font-bold"
                          style={{
                            color: i <= step ? "var(--on-accent)" : "rgb(var(--ink-rgb) / .5)",
                            background: i <= step ? "var(--lime)" : "rgb(var(--ink-rgb) / .1)",
                          }}
                        >
                          {i < step ? <Icon name="check" size={10} /> : i + 1}
                        </span>
                        {STEP_LABELS[s]}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {phase === "ready" && result && refining && (
                <div className="mb-3 text-[12.5px] text-ink/55">Refining title, summary and tags…</div>
              )}
              {phase === "ready" && result && (
                <ReadyForm
                  result={result}
                  title={title}
                  setTitle={(v) => {
                    editedRef.current.add("title");
                    setTitle(v);
                  }}
                  excerpt={excerpt}
                  setExcerpt={(v) => {
                    editedRef.current.add("excerpt");
                    setExcerpt(v);
                  }}
                  tags={tags}
                  setTags={(v) => {
                    editedRef.current.add("tags");
                    setTags(v);
                  }}
                  suggestions={suggestTags(
                    "failed" in result ? [] : result.suggestedTags,
                    libraryTags,
                    `${title} ${excerpt} ${result.domain}`
                  )}
                  collectionId={collectionId}
                  setCollectionId={setCollectionId}
                  size={size}
                  setSize={setSize}
                  collections={collections}
                  collectionError={collectionError}
                  onCollectionBlur={() => setTouched((t) => ({ ...t, collection: true }))}
                  onSave={handleSave}
                  saving={saving}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReadyForm({
  result,
  title,
  setTitle,
  excerpt,
  setExcerpt,
  tags,
  setTags,
  suggestions,
  collectionId,
  setCollectionId,
  size,
  setSize,
  collections,
  collectionError,
  onCollectionBlur,
  onSave,
  saving,
}: {
  result: ReadyResult;
  title: string;
  setTitle: (v: string) => void;
  excerpt: string;
  setExcerpt: (v: string) => void;
  tags: string[];
  setTags: (v: string[]) => void;
  suggestions: string[];
  collectionId: string;
  setCollectionId: (v: string) => void;
  size: CardSize;
  setSize: (v: CardSize) => void;
  collections: Collection[];
  collectionError?: boolean;
  onCollectionBlur: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const failed = "failed" in result;
  const heroImage = failed ? undefined : result.heroImage;
  const excerptOnly = !failed && result.excerptOnly;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="flex flex-col gap-3">
        {excerptOnly && (
          <div className="rounded-[14px] px-4 py-3 text-[12.5px] text-ink/55" style={{ background: "rgba(255,90,31,.14)" }}>
            The site wouldn&apos;t give up the full page — this card is built from its metadata and
            written up by AI. Worth a glance before you save.
          </div>
        )}
        {failed && (
          <div className="rounded-[14px] px-4 py-3 text-[12.5px] text-ink/55" style={{ background: "rgba(255,90,31,.14)" }}>
            The page wouldn&apos;t open ({result.reason}) — the title is guessed from the link.
            Edit it and save; nothing else is needed.
          </div>
        )}
        <div className="overflow-hidden rounded-[22px]" style={{ background: "rgb(var(--surface-rgb) / .62)", border: "1px solid rgb(var(--rim-rgb) / .75)" }}>
          <div className={`relative w-full ${heroImage ? "h-[170px]" : "h-14 sm:h-[170px]"}`} style={{ background: heroImage ? undefined : result.tint }}>
            {heroImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={heroImage} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="flex flex-col gap-1.5 px-4 py-3.5">
            <div className="flex items-center gap-2 text-[11.5px] text-ink/50">
              <span
                className="flex h-[18px] w-[18px] items-center justify-center rounded-[6px] text-[9px] font-bold"
                style={{ color: result.stripe, background: result.tint }}
              >
                {result.initial}
              </span>
              {result.domain}
            </div>
            <div className="truncate text-[17px] font-semibold tracking-[-.038em] text-ink">
              {title || "Untitled link"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[12px]">
          <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-lime text-[10px] font-bold text-on-accent"><Icon name="check" size={10} /></span>
          <span className="text-ink/55">{failed ? "Filled in from the link — check it" : "Crawled — check the details"}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-eyebrow text-ink/40">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-[42px] rounded-[12px] border px-3.5 text-[13.5px] text-ink outline-none"
            style={{ borderColor: "rgb(var(--ink-rgb) / 0.16)", background: "rgb(var(--ink-rgb) / 0.05)" }}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-eyebrow text-ink/40">Excerpt</span>
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={3}
            className="max-h-48 min-h-[86px] resize-none rounded-[12px] border px-3.5 py-2.5 text-[13.5px] [field-sizing:content] text-ink outline-none"
            style={{ borderColor: "rgb(var(--ink-rgb) / 0.16)", background: "rgb(var(--ink-rgb) / 0.05)" }}
          />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-eyebrow text-ink/40">Tags</span>
          <TagPicker value={tags} suggestions={suggestions} onChange={setTags} />
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-eyebrow text-ink/40">Collection</span>
          <select
            value={collectionId}
            onChange={(e) => setCollectionId(e.target.value)}
            onBlur={onCollectionBlur}
            className="h-[42px] rounded-[12px] border px-3.5 text-[13.5px] text-ink outline-none"
            style={{
              borderColor: collectionError ? "#ff5a1f" : "rgb(var(--ink-rgb) / 0.16)",
              background: "rgb(var(--ink-rgb) / 0.05)",
            }}
          >
            <option value="" disabled>
              Choose a collection
            </option>
            {collections
              .filter((c) => !c.isSmart)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          {collectionError && <span className="text-[11px] text-signal-soft">Pick a collection to save into.</span>}
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-eyebrow text-ink/40">Card size *</span>
          <div className="flex gap-1.5">
            {CARD_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className="h-9 flex-1 rounded-[10px] text-[12px] font-semibold"
                style={{
                  background: s === size ? "var(--lime)" : "rgb(var(--ink-rgb) / .05)",
                  color: s === size ? "var(--on-accent)" : "rgb(var(--ink-rgb) / .6)",
                  border: "1px solid rgb(var(--ink-rgb) / 0.12)",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          // Pinned on phones so Save never ends up below the fold of a long form.
          className="z-10 mt-1 h-[46px] rounded-full bg-signal text-[13.5px] font-semibold text-on-accent shadow-[0_10px_30px_rgba(0,0,0,.45)] disabled:opacity-60 max-md:sticky max-md:bottom-[max(12px,env(safe-area-inset-bottom))]"
        >
          {saving ? "Saving…" : "Save to library"}
        </button>
      </div>
    </div>
  );
}

/** Picked tags, plus the ones worth offering: what the crawler found and what the rest of
 * the library already calls pages like this one. Typing wins over both. */
function TagPicker({
  value,
  suggestions,
  onChange,
}: {
  value: string[];
  suggestions: string[];
  onChange: (tags: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const unpicked = suggestions.filter((t) => !value.includes(t));

  const add = (tag: string) => {
    const clean = tag.trim();
    if (clean && !value.includes(clean)) onChange([...value, clean]);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onChange(value.filter((t) => t !== tag))}
            title="Remove"
            className="inline-flex items-center gap-1.5 rounded-full bg-lime px-2.5 py-1 text-[11.5px] font-medium text-on-accent"
          >
            {tag}
            <Icon name="close" size={9} className="text-ink/45" />
          </button>
        ))}
        {value.length === 0 && <span className="text-[12px] text-ink/40">No tags yet</span>}
      </div>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(draft);
          }
        }}
        onBlur={() => add(draft)}
        placeholder="Add a tag, then Enter"
        className="h-[38px] rounded-[12px] border px-3.5 text-[13px] text-ink outline-none placeholder:text-ink/40"
        style={{ borderColor: "rgb(var(--ink-rgb) / 0.16)", background: "rgb(var(--ink-rgb) / 0.05)" }}
      />
      {unpicked.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {unpicked.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => add(tag)}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] text-ink/55 hover:text-ink"
              style={{ borderColor: "rgb(var(--ink-rgb) / 0.16)" }}
            >
              <span className="text-signal">+</span>
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
