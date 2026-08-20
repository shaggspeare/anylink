"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useLibrary } from "@/lib/store";
import { Chip } from "./chip";
import type { LinkItem } from "@/lib/types";

function withHighlights(paragraph: string, quotes: string[]) {
  if (quotes.length === 0) return paragraph;
  const pattern = quotes
    .filter((q) => paragraph.includes(q))
    .sort((a, b) => b.length - a.length);
  if (pattern.length === 0) return paragraph;
  let remaining = paragraph;
  const parts: React.ReactNode[] = [];
  let key = 0;
  while (remaining.length > 0) {
    const match = pattern.find((q) => remaining.includes(q));
    if (!match) {
      parts.push(remaining);
      break;
    }
    const idx = remaining.indexOf(match);
    if (idx > 0) parts.push(remaining.slice(0, idx));
    parts.push(
      <mark key={key++} className="rounded-[3px] bg-lime/60 px-0.5 text-ink">
        {match}
      </mark>
    );
    remaining = remaining.slice(idx + match.length);
  }
  return parts;
}

export function ReaderPanel({
  link,
  onOpenCollection,
}: {
  link: LinkItem;
  onOpenCollection: () => void;
}) {
  const { links, addHighlight } = useLibrary();
  const articleRef = useRef<HTMLDivElement>(null);
  const [popover, setPopover] = useState<{ x: number; y: number; text: string } | null>(null);

  const handleMouseUp = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (!selection || !text || !articleRef.current || selection.rangeCount === 0) {
      setPopover(null);
      return;
    }
    const range = selection.getRangeAt(0);
    if (!articleRef.current.contains(range.commonAncestorContainer)) {
      setPopover(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    const containerRect = articleRef.current.getBoundingClientRect();
    setPopover({ x: rect.left - containerRect.left + rect.width / 2, y: rect.top - containerRect.top, text });
  };

  const highlightQuotes = (link.highlights ?? []).map((h) => h.quote);
  const alsoInLibrary = links
    .filter((l) => l.id !== link.id && l.collectionId === link.collectionId && !l.archived)
    .slice(0, 3);

  const paragraphs = link.articleText ?? [link.excerpt];

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:items-start">
      <article
        className="relative flex-1 overflow-hidden rounded-[28px]"
        style={{ background: "rgba(255,255,255,.72)", border: "1px solid rgba(255,255,255,.85)", backdropFilter: "blur(22px)" }}
      >
        <div className="relative h-[250px] w-full overflow-hidden bg-[#dfe2e5]">
          {link.heroImage ? (
            <Image src={link.heroImage} alt="" fill sizes="900px" className="object-cover" />
          ) : (
            <div className="absolute inset-0" style={{ background: link.tint }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-6">
            <span className="text-eyebrow text-white/70">{link.domain}</span>
            <h1 className="text-title max-w-[600px] text-[28px] text-white">{link.title}</h1>
          </div>
        </div>

        <div
          ref={articleRef}
          onMouseUp={handleMouseUp}
          className="relative mx-auto max-w-[600px] px-6 py-8 text-[15px] leading-[1.7] text-ink/80 sm:px-8"
        >
          {link.contentType === "video" ? (
            <div className="flex flex-col items-center gap-3 rounded-[18px] bg-ink/6 py-14 text-center">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="rgba(23,24,27,.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 3v18l15-9L5 3z" />
              </svg>
              <p className="max-w-[360px] text-body text-ink/55">
                Video — open the original to watch. AnyLink stores the description and thumbnail only.
              </p>
            </div>
          ) : (
            paragraphs.map((p, i) => (
              <p key={i} className="mb-5">
                {withHighlights(p, highlightQuotes)}
              </p>
            ))
          )}

          {popover && (
            <button
              type="button"
              onClick={() => {
                addHighlight(link.id, popover.text);
                setPopover(null);
                window.getSelection()?.removeAllRanges();
              }}
              style={{ left: popover.x, top: popover.y - 42, transform: "translateX(-50%)" }}
              className="absolute z-10 flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[11.5px] font-semibold text-[#f4f5f6] shadow-lg"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-lime" /> Highlight
            </button>
          )}
        </div>
      </article>

      <aside className="flex w-full flex-none flex-col gap-4 lg:w-[320px]">
        <RailSection title="Saved metadata">
          <RailRow label="Domain" value={link.domain} />
          <RailRow label="Saved" value={new Date(link.createdAt).toLocaleDateString()} />
          {link.readingTimeMinutes && <RailRow label="Reading time" value={`${link.readingTimeMinutes} min`} />}
        </RailSection>

        <RailSection title="Tags">
          <div className="flex flex-wrap gap-1.5">
            {link.tags.map((t) => (
              <Chip key={t} className="cursor-default">
                {t}
              </Chip>
            ))}
            {link.tags.length === 0 && <span className="text-body text-ink/40">No tags yet.</span>}
          </div>
        </RailSection>

        <RailSection title="Also in your library" action={<button onClick={onOpenCollection} className="text-[11.5px] font-semibold text-ink/50 hover:text-ink">See all</button>}>
          <div className="flex flex-col gap-2">
            {alsoInLibrary.length === 0 && <span className="text-body text-ink/40">Nothing else here yet.</span>}
            {alsoInLibrary.map((l) => (
              <Link
                key={l.id}
                href={`/links/${l.id}`}
                className="flex items-center gap-2.5 rounded-[12px] px-2 py-1.5 hover:bg-ink/6"
              >
                <span
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] text-[10px] font-bold"
                  style={{ color: l.stripe, background: l.tint }}
                >
                  {l.initial}
                </span>
                <span className="truncate text-body text-ink/75">{l.title}</span>
              </Link>
            ))}
          </div>
        </RailSection>
      </aside>
    </div>
  );
}

function RailSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-2.5 rounded-[22px] p-4"
      style={{ background: "rgba(255,255,255,.55)", border: "1px solid rgba(255,255,255,.8)", backdropFilter: "blur(20px) saturate(1.4)" }}
    >
      <div className="flex items-center">
        <span className="text-eyebrow text-ink/40">{title}</span>
        {action && <span className="ml-auto">{action}</span>}
      </div>
      {children}
    </div>
  );
}

function RailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-ink/50">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}
