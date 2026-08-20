"use client";

import { useEffect, useRef, useState } from "react";
import { useLibrary } from "@/lib/store";
import { mockCrawl, type CrawlResult } from "@/lib/mock-crawl";
import type { CardSize } from "@/lib/types";
import { AmbientOrbs } from "./ambient-orbs";

type Phase = "idle" | "crawling" | "ready";

const STEP_LABELS = ["Fetching page", "Reading content", "Saving images", "Suggesting tags"];

export function AddLinkFlow() {
  const { addLinkOpen, addLinkPrefillUrl, closeAddLink, addLink, collections } = useLibrary();

  const [phase, setPhase] = useState<Phase>("idle");
  const [url, setUrl] = useState("");
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<CrawlResult | null>(null);
  const [clipboardHint, setClipboardHint] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [size, setSize] = useState<CardSize>("M");
  const [touched, setTouched] = useState<{ collection?: boolean; size?: boolean }>({});

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = () => {
    setPhase("idle");
    setUrl("");
    setStep(0);
    setResult(null);
    setTitle("");
    setExcerpt("");
    setCollectionId("");
    setSize("M");
    setTouched({});
    setClipboardHint(null);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const runCrawl = (targetUrl: string) => {
    setUrl(targetUrl);
    setPhase("crawling");
    setStep(0);
    const advance = (n: number) => {
      timerRef.current = setTimeout(() => {
        if (n < STEP_LABELS.length - 1) {
          setStep(n + 1);
          advance(n + 1);
        } else {
          const crawlResult = mockCrawl(targetUrl);
          setResult(crawlResult);
          setTitle(crawlResult.title);
          setExcerpt(crawlResult.excerpt);
          setPhase("ready");
        }
      }, 550);
    };
    advance(0);
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

  const handleSave = () => {
    setTouched({ collection: true, size: true });
    if (!canSave || !result) return;
    addLink({
      url,
      domain: result.domain,
      title: title || result.domain,
      excerpt,
      heroImage: result.heroImage,
      tint: result.tint,
      stripe: result.stripe,
      initial: result.initial,
      contentType: result.contentType,
      readingTimeMinutes: result.readingTimeMinutes,
      collectionId,
      tags: result.suggestedTags,
      size,
    });
    handleClose();
  };

  const wide = phase === "ready";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      style={{ background: "rgba(13,14,16,.42)", backdropFilter: "blur(6px)" }}
      onClick={handleClose}
    >
      <div
        className={`relative w-full overflow-hidden rounded-[30px] transition-[max-width] ${
          wide ? "max-w-3xl" : "max-w-[620px]"
        }`}
        style={{ boxShadow: "0 40px 90px rgba(0,0,0,.5)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative min-h-[420px] overflow-hidden" style={{ background: "#111214" }}>
          <AmbientOrbs variant="dark" />
          <div className="relative flex h-full flex-col">
            <div className="flex items-center gap-3 px-6 pt-6">
              <h3 className="text-title text-[#f4f5f6]">Add a link</h3>
              <span className="ml-auto text-eyebrow text-light-40">⌘V anywhere</span>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close"
                className="flex h-7 w-7 items-center justify-center rounded-full text-light-55 hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="flex gap-2 px-6 pt-4">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFetch()}
                placeholder="https://"
                disabled={phase !== "idle"}
                className="h-[46px] min-w-0 flex-1 rounded-full border px-4.5 text-[14px] text-[#f4f5f6] outline-none disabled:opacity-50"
                style={{ borderColor: "rgba(255,255,255,.16)", background: "rgba(255,255,255,.06)" }}
              />
              <button
                type="button"
                onClick={async () => {
                  const text = await navigator.clipboard?.readText().catch(() => "");
                  if (text) setUrl(text.trim());
                }}
                disabled={phase !== "idle"}
                className="flex-none rounded-full border px-4.5 text-[13px] font-medium text-[#f4f5f6] disabled:opacity-50"
                style={{ borderColor: "rgba(255,255,255,.16)" }}
              >
                Paste
              </button>
              <button
                type="button"
                onClick={handleFetch}
                disabled={phase !== "idle"}
                className="flex-none rounded-full bg-signal px-5 text-[13px] font-semibold text-[#111214] disabled:opacity-50"
              >
                Fetch
              </button>
            </div>

            <div className="flex-1 px-6 pb-6 pt-5">
              {phase === "idle" && (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="flex flex-col items-start gap-3.5 rounded-[22px] border border-dashed px-6.5 py-7.5"
                  style={{ borderColor: "rgba(255,255,255,.18)" }}
                >
                  <div className="flex h-[46px] w-[46px] items-center justify-center rounded-[14px]" style={{ background: "rgba(255,90,31,.18)" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff8a5c" strokeWidth="2.4" strokeLinecap="round">
                      <path d="M9.5 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
                      <path d="M14.5 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
                    </svg>
                  </div>
                  <div className="text-[18px] font-semibold tracking-[-.035em] text-[#f4f5f6]">
                    Nothing to read yet
                  </div>
                  <div className="max-w-[420px] text-[13px] leading-[1.6] text-light-55">
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
                      className="flex w-full items-center gap-2.5 rounded-[14px] px-4 py-3 text-left text-[12.5px] text-light-55 hover:text-[#f4f5f6]"
                      style={{ background: "rgba(255,255,255,.06)" }}
                    >
                      <span className="text-lime">On your clipboard</span>
                      <span className="truncate">{clipboardHint}</span>
                    </button>
                  )}
                </div>
              )}

              {phase === "crawling" && (
                <div
                  className="flex flex-col gap-4.5 rounded-[22px] p-6"
                  style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-[15px] font-semibold tracking-[-.03em] text-[#f4f5f6]">
                      Reading the page…
                    </div>
                    <div className="ml-auto font-mono text-[13px] font-semibold text-lime tabular-nums">
                      {Math.round(((step + 1) / STEP_LABELS.length) * 100)}%
                    </div>
                  </div>
                  <div className="h-[5px] overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,.12)" }}>
                    <div
                      className="h-full rounded-full bg-lime transition-[width] duration-500"
                      style={{ width: `${((step + 1) / STEP_LABELS.length) * 100}%` }}
                    />
                  </div>
                  <div className="flex flex-col gap-3">
                    {STEP_LABELS.map((label, i) => (
                      <div
                        key={label}
                        className="flex items-center gap-2.5 text-[13px]"
                        style={{ color: i <= step ? "#f4f5f6" : "rgba(244,245,246,.4)" }}
                      >
                        <span
                          className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full text-[10px] font-bold"
                          style={{
                            color: i < step ? "#17181b" : i === step ? "#17181b" : "rgba(244,245,246,.5)",
                            background: i <= step ? "#d6f24b" : "rgba(255,255,255,.1)",
                          }}
                        >
                          {i < step ? "✓" : i + 1}
                        </span>
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {phase === "ready" && result && (
                <ReadyForm
                  result={result}
                  title={title}
                  setTitle={setTitle}
                  excerpt={excerpt}
                  setExcerpt={setExcerpt}
                  collectionId={collectionId}
                  setCollectionId={setCollectionId}
                  size={size}
                  setSize={setSize}
                  collections={collections}
                  collectionError={collectionError}
                  onCollectionBlur={() => setTouched((t) => ({ ...t, collection: true }))}
                  onSave={handleSave}
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
  collectionId,
  setCollectionId,
  size,
  setSize,
  collections,
  collectionError,
  onCollectionBlur,
  onSave,
}: {
  result: CrawlResult;
  title: string;
  setTitle: (v: string) => void;
  excerpt: string;
  setExcerpt: (v: string) => void;
  collectionId: string;
  setCollectionId: (v: string) => void;
  size: CardSize;
  setSize: (v: CardSize) => void;
  collections: { id: string; name: string; color: string }[];
  collectionError?: boolean;
  onCollectionBlur: () => void;
  onSave: () => void;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="flex flex-col gap-3">
        {result.excerptOnly && (
          <div className="rounded-[14px] px-4 py-3 text-[12.5px] text-light-55" style={{ background: "rgba(255,90,31,.14)" }}>
            Paywalled — only a summary could be read. Fill in the rest by hand.
          </div>
        )}
        {result.failed && (
          <div className="rounded-[14px] px-4 py-3 text-[12.5px] text-light-55" style={{ background: "rgba(255,90,31,.14)" }}>
            Crawl failed — the page blocked the fetch. Add the details manually below.
          </div>
        )}
        <div className="overflow-hidden rounded-[22px]" style={{ background: "rgba(255,255,255,.62)", border: "1px solid rgba(255,255,255,.75)" }}>
          <div className="relative h-[170px] w-full" style={{ background: result.heroImage ? undefined : result.tint }}>
            {result.heroImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={result.heroImage} alt="" className="h-full w-full object-cover" />
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
        <div className="flex items-center gap-1.5 text-[12px] text-lime">
          <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-lime text-[10px] font-bold text-ink">✓</span>
          <span className="text-light-55">Crawled — check the details</span>
        </div>
      </div>

      <div className="flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-eyebrow text-light-40">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-[42px] rounded-[12px] border px-3.5 text-[13.5px] text-[#f4f5f6] outline-none"
            style={{ borderColor: "rgba(255,255,255,.16)", background: "rgba(255,255,255,.06)" }}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-eyebrow text-light-40">Excerpt</span>
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={3}
            className="resize-none rounded-[12px] border px-3.5 py-2.5 text-[13.5px] text-[#f4f5f6] outline-none"
            style={{ borderColor: "rgba(255,255,255,.16)", background: "rgba(255,255,255,.06)" }}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-eyebrow text-light-40">Collection *</span>
          <select
            value={collectionId}
            onChange={(e) => setCollectionId(e.target.value)}
            onBlur={onCollectionBlur}
            className="h-[42px] rounded-[12px] border px-3.5 text-[13.5px] text-[#f4f5f6] outline-none"
            style={{
              borderColor: collectionError ? "#ff5a1f" : "rgba(255,255,255,.16)",
              background: "rgba(255,255,255,.06)",
            }}
          >
            <option value="" disabled>
              Choose a collection
            </option>
            {collections.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#111214]">
                {c.name}
              </option>
            ))}
          </select>
          {collectionError && <span className="text-[11px] text-signal-soft">Pick a collection to save into.</span>}
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-eyebrow text-light-40">Card size *</span>
          <div className="flex gap-1.5">
            {(["S", "M", "L"] as CardSize[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className="h-9 flex-1 rounded-[10px] text-[12px] font-semibold"
                style={{
                  background: s === size ? "#d6f24b" : "rgba(255,255,255,.06)",
                  color: s === size ? "#17181b" : "rgba(244,245,246,.6)",
                  border: "1px solid rgba(255,255,255,.12)",
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
          className="mt-1 h-[46px] rounded-full bg-signal text-[13.5px] font-semibold text-[#111214]"
        >
          Save to library
        </button>
      </div>
    </div>
  );
}
