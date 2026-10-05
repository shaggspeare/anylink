"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLibrary } from "@/lib/store";
import { Sidebar } from "@/components/sidebar";
import { AmbientOrbs } from "@/components/ambient-orbs";
import { HeroArt } from "@/components/card";
import { Icon } from "@/components/icon";
import { suggestCollection } from "@/lib/organize";
import { swipeDirection } from "@/lib/geometry";
import type { LinkItem } from "@/lib/types";

const MAX_ALTERNATIVES = 5;

/** Sort Unsorted: one inbox link at a time, filed into its suggested collection, another
 * one, Trash, or skipped for now. Every action has Undo (the store's toasts), and the
 * queue is re-derived from the inbox, so an undone link drops straight back in. */
export default function TriagePage() {
  const { links, collections, inbox, moveLinks, deleteLinks, logSignal, countForCollection } = useLibrary();
  // The links that were unsorted when you opened this; new arrivals wait for next time.
  const [queue] = useState(() => links.filter((l) => l.collectionId === inbox?.id && !l.archived).map((l) => l.id));
  const [later, setLater] = useState<Set<string>>(new Set());
  const [dragX, setDragX] = useState(0);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  const byId = new Map(links.map((l) => [l.id, l]));
  const remaining = queue
    .map((id) => byId.get(id))
    .filter((l): l is LinkItem => Boolean(l && l.collectionId === inbox?.id && !l.archived && !later.has(l.id)));
  const link = remaining[0];
  const suggestion = link && suggestCollection(link, links, collections);
  const alternatives = collections
    .filter((c) => !c.isInbox && !c.isSmart && c.id !== suggestion?.id)
    .sort((a, b) => countForCollection(b.id) - countForCollection(a.id))
    .slice(0, MAX_ALTERNATIVES);
  const done = queue.length - remaining.length;

  const accept = (target: LinkItem) => {
    if (!suggestion) return;
    logSignal("accept", { linkId: target.id, collectionId: suggestion.id });
    moveLinks([target.id], suggestion.id, true);
  };
  const fileInto = (target: LinkItem, collectionId: string) => {
    if (suggestion && suggestion.id !== collectionId) {
      logSignal("reject", { linkId: target.id, collectionId: suggestion.id });
    }
    moveLinks([target.id], collectionId, true);
  };
  const kill = (target: LinkItem) => {
    logSignal("kill", { linkId: target.id });
    deleteLinks([target.id]);
  };
  const skip = (target: LinkItem) => {
    logSignal("later", { linkId: target.id });
    setLater((prev) => new Set(prev).add(target.id));
  };

  // Desktop: ← Trash, → file into the suggestion, L later, 1–5 the alternatives.
  useEffect(() => {
    if (!link) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement).closest("input, textarea, [contenteditable]")) return;
      const alt = alternatives[Number(e.key) - 1];
      if (e.key === "ArrowLeft") kill(link);
      else if (e.key === "ArrowRight") accept(link);
      else if (e.key.toLowerCase() === "l") skip(link);
      else if (alt) fileInto(link, alt.id);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    // overflow-clip, not -hidden: it still clips the orbs but doesn't break the sticky buttons.
    <div className="relative min-h-screen overflow-clip bg-canvas">
      <AmbientOrbs variant="library" />
      <Sidebar />
      <div className="relative lg:pl-[250px]">
        <div className="mx-auto flex max-w-[520px] flex-col gap-4 px-4 pb-10 pt-[max(24px,env(safe-area-inset-top))]">
          {/* Phones: a pushed screen like iOS — no tab bar over the buttons, a way back instead. */}
          <Link href="/app" className="-mb-2 flex items-center gap-1 self-start text-[15px] font-semibold text-ink lg:hidden">
            <Icon name="arrow-left" size={14} /> Library
          </Link>
          <header className="flex items-end gap-3">
            <h1 className="text-hero text-[30px]">Sort Unsorted</h1>
            {link && (
              <span className="pb-1.5 text-meta text-ink/50">
                {Math.min(done + 1, queue.length)} of {queue.length}
              </span>
            )}
          </header>

          {link ? (
            <>
              <div className="h-1 overflow-hidden rounded-full bg-ink/8">
                <div
                  className="h-full rounded-full bg-lime transition-[width] duration-500"
                  style={{ width: `${(done / queue.length) * 100}%` }}
                />
              </div>

              {suggestion && (
                <span
                  className="self-start rounded-full px-3 py-1.5 text-[12.5px] text-ink"
                  style={{ background: "rgba(124,140,255,.18)" }}
                >
                  ✦ Looks like <b>{suggestion.name}</b>
                </span>
              )}

              <article
                key={link.id}
                // Touch: drag sideways past the threshold to commit, same as the buttons.
                onPointerDown={(e) => {
                  if ((e.target as HTMLElement).closest("a")) return;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setDragStart({ x: e.clientX, y: e.clientY });
                }}
                onPointerMove={(e) => dragStart && setDragX(e.clientX - dragStart.x)}
                onPointerUp={(e) => {
                  if (!dragStart) return;
                  const dir = swipeDirection(e.clientX - dragStart.x, e.clientY - dragStart.y);
                  setDragStart(null);
                  setDragX(0);
                  if (dir === "left") kill(link);
                  if (dir === "right") accept(link);
                }}
                onPointerCancel={() => {
                  setDragStart(null);
                  setDragX(0);
                }}
                className="glass-55 touch-pan-y select-none overflow-hidden rounded-[27px] p-2"
                style={{
                  transform: `translateX(${dragX}px) rotate(${dragX / 40}deg)`,
                  transition: dragStart ? "none" : "transform .22s cubic-bezier(.2,.9,.3,1.15)",
                }}
              >
                <div className="relative h-[176px] overflow-hidden rounded-[19px] max-sm:h-[124px]">
                  <HeroArt link={link} sizes="520px" />
                </div>
                <div className="flex flex-col gap-1.5 px-2 pb-3 pt-3">
                  <span className="truncate text-meta text-ink/50">
                    {[link.domain, link.readingTimeMinutes && `${link.readingTimeMinutes} min read`]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <a
                    href={link.url || `/links/${link.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="line-clamp-3 text-[19px] font-semibold leading-tight tracking-[-0.72px] text-ink hover:underline"
                  >
                    {link.title}
                  </a>
                  {link.excerpt && <p className="line-clamp-3 text-body text-ink/60">{link.excerpt}</p>}
                  {link.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {link.tags.slice(0, 4).map((t) => (
                        <span key={t} className="rounded-full bg-ink/6 px-2.5 py-1 text-[12px] text-ink/75">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </article>

              {alternatives.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-meta text-ink/55">{suggestion ? "Or:" : "File into:"}</span>
                  {alternatives.map((c, i) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => fileInto(link, c.id)}
                      className="flex items-center gap-1.5 rounded-full bg-ink/6 px-3 py-1.5 text-[12.5px] font-medium text-ink hover:bg-ink/10"
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                      {c.name}
                      <kbd className="hidden font-mono text-[10px] text-ink/40 lg:inline">{i + 1}</kbd>
                    </button>
                  ))}
                </div>
              )}

              {/* Pinned under the thumb on phones, where the card pushes it off-screen. */}
              <div className="flex items-center gap-2.5 pt-2 max-lg:sticky max-lg:bottom-[max(12px,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={() => kill(link)}
                  aria-label="Move to Trash"
                  title="Move to Trash (←)"
                  className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-full bg-ink text-on-ink"
                >
                  <Icon name="trash" size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => skip(link)}
                  title="Later (L)"
                  className="h-[52px] flex-none rounded-full border border-rim/90 bg-surface/70 px-5 text-body font-semibold text-ink"
                >
                  Later
                </button>
                {suggestion && (
                  <button
                    type="button"
                    onClick={() => accept(link)}
                    title={`File into ${suggestion.name} (→)`}
                    className="h-[52px] min-w-0 flex-1 truncate rounded-full bg-signal px-5 text-body font-semibold text-on-accent"
                  >
                    {suggestion.name} →
                  </button>
                )}
              </div>
              <p className="hidden text-center text-meta text-ink/40 lg:block">
                ← Trash{suggestion && ` · → ${suggestion.name}`} · L later
                {alternatives.length > 0 && ` · ${alternatives.length > 1 ? `1–${alternatives.length}` : "1"} pick one`}
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3.5 py-20 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-lime text-on-accent">
                <Icon name="check" size={26} />
              </span>
              <h2 className="text-title">Unsorted is clear</h2>
              <p className="max-w-[340px] text-lead text-ink/60">
                Everything has a home. New links will land here again until you sort them.
              </p>
              <Link
                href="/app"
                className="mt-2 flex h-11 items-center rounded-full bg-ink px-5 text-body font-semibold text-on-ink"
              >
                Back to library
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
