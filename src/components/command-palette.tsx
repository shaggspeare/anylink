"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLibrary } from "@/lib/store";
import { searchLinks } from "@/lib/search";

type ResultKind = "link" | "tag" | "collection" | "query";
type Result = { kind: ResultKind; id: string; label: string; sub?: string };

function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-[3px] bg-lime px-0.5 text-ink">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function CommandPalette() {
  const { paletteOpen, closePalette, links, tags, collections, saveSmartCollection } = useLibrary();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const resetForOpen = () => {
    setQuery("");
    setActiveIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  useEffect(() => {
    if (!paletteOpen) return;
    const kickoff = setTimeout(resetForOpen, 0);
    return () => clearTimeout(kickoff);
  }, [paletteOpen]);

  const q = query.trim().toLowerCase();

  // Same parser the sidebar filters and smart collections use, so `type:video -#work`
  // works here without the palette knowing what any of those operators mean.
  const matches = useMemo(() => searchLinks(links, q), [links, q]);
  const linkResults: Result[] = useMemo(
    () => matches.slice(0, 6).map((l) => ({ kind: "link" as const, id: l.id, label: l.title, sub: l.domain })),
    [matches]
  );

  const tagResults: Result[] = useMemo(() => {
    if (!q) return [];
    const term = q.replace(/^[-#]+/, "");
    return tags
      .filter((t) => term.length > 0 && t.toLowerCase().includes(term))
      .slice(0, 4)
      .map((t) => ({ kind: "tag" as const, id: t, label: t }));
  }, [tags, q]);

  const collectionResults: Result[] = useMemo(() => {
    const source = q ? collections.filter((c) => c.name.toLowerCase().includes(q)) : collections.slice(0, 4);
    return source.slice(0, 4).map((c) => ({ kind: "collection" as const, id: c.id, label: c.name }));
  }, [collections, q]);

  const allResults: Result[] =
    q && matches.length > linkResults.length
      ? [{ kind: "query", id: "all", label: `Show all ${matches.length} matches` }]
      : [];

  const flat = [...linkResults, ...allResults, ...tagResults, ...collectionResults];

  const openResult = (r: Result, openOriginal = false) => {
    if (r.kind === "query") {
      router.push(`/?q=${encodeURIComponent(q)}`);
    } else if (r.kind === "link") {
      if (openOriginal) {
        const link = links.find((l) => l.id === r.id);
        if (link) window.open(link.url, "_blank", "noopener,noreferrer");
        return;
      }
      router.push(`/links/${r.id}`);
    } else if (r.kind === "collection") {
      router.push(`/collections/${r.id}`);
    } else if (r.kind === "tag") {
      setQuery(`#${r.label}`);
      return;
    }
    closePalette();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = flat[activeIndex];
      if (r) openResult(r, e.metaKey || e.ctrlKey);
    } else if (e.key === "s" && (e.metaKey || e.ctrlKey) && q) {
      e.preventDefault();
      // Named on the way in — a saved filter you can't recognise in the sidebar is dead weight.
      const name = window.prompt("Name this filter", q);
      if (name === null) return;
      saveSmartCollection(q, name);
      closePalette();
    }
  };

  if (!paletteOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-start justify-center pt-[12vh]"
      style={{ background: "rgba(13,14,16,.42)", backdropFilter: "blur(6px)" }}
      onClick={closePalette}
    >
      <div
        className="w-full max-w-[720px] overflow-hidden rounded-[26px]"
        style={{ boxShadow: "var(--shadow-window)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="glass-70 flex flex-col">
          <div className="flex items-center gap-3 border-b border-white/60 px-5 py-4">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(23,24,27,.4)" strokeWidth="2.4" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search — or filter with type: #tag -word is:favorite"
              className="flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink/40"
            />
          </div>

          <div className="max-h-[50vh] overflow-y-auto px-2 py-2">
            {linkResults.length > 0 && (
              <ResultGroup label="Links">
                {linkResults.map((r) => (
                  <ResultRow
                    key={r.id}
                    active={flat[activeIndex]?.id === r.id && flat[activeIndex]?.kind === "link"}
                    onClick={() => openResult(r)}
                  >
                    <span className="truncate">
                      <Highlighted text={r.label} query={q} />
                    </span>
                    <span className="ml-auto flex-none text-meta text-ink/45">{r.sub}</span>
                  </ResultRow>
                ))}
              </ResultGroup>
            )}
            {allResults.map((r) => (
              <ResultRow
                key="all"
                active={flat[activeIndex]?.kind === "query"}
                onClick={() => openResult(r)}
              >
                <span className="text-ink/70">{r.label}</span>
                <span className="ml-auto flex-none text-meta text-ink/40">in the library</span>
              </ResultRow>
            ))}
            {(tagResults.length > 0 || collectionResults.length > 0) && (
              <ResultGroup label="Tags & collections">
                {tagResults.map((r) => (
                  <ResultRow
                    key={`tag-${r.id}`}
                    active={flat[activeIndex]?.id === r.id && flat[activeIndex]?.kind === "tag"}
                    onClick={() => openResult(r)}
                  >
                    <span className="text-ink/50">#</span>
                    <Highlighted text={r.label} query={q} />
                  </ResultRow>
                ))}
                {collectionResults.map((r) => (
                  <ResultRow
                    key={`col-${r.id}`}
                    active={flat[activeIndex]?.id === r.id && flat[activeIndex]?.kind === "collection"}
                    onClick={() => openResult(r)}
                  >
                    <Highlighted text={r.label} query={q} />
                  </ResultRow>
                ))}
              </ResultGroup>
            )}
            {flat.length === 0 && (
              <div className="px-4 py-8 text-center text-body text-ink/45">No matches.</div>
            )}
          </div>

          <div className="flex items-center gap-4 border-t border-white/60 px-5 py-3 text-meta text-ink/45">
            <span className="flex items-center gap-1.5">
              <kbd className="rounded-[5px] bg-ink/6 px-1.5 py-0.5 font-mono text-[10px]">↑↓</kbd> navigate
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="rounded-[5px] bg-ink/6 px-1.5 py-0.5 font-mono text-[10px]">↵</kbd> open
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="rounded-[5px] bg-ink/6 px-1.5 py-0.5 font-mono text-[10px]">⌘↵</kbd> open original
            </span>
            {q && (
              <span className="ml-auto flex items-center gap-1.5">
                <kbd className="rounded-[5px] bg-ink/6 px-1.5 py-0.5 font-mono text-[10px]">⌘S</kbd> save as a custom filter
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <div className="px-3 py-1.5 text-eyebrow text-ink/40">{label}</div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function ResultRow({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left text-body text-ink"
      style={{ background: active ? "rgba(23,24,27,.06)" : "transparent" }}
    >
      {children}
    </button>
  );
}
