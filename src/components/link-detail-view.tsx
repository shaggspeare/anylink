"use client";

import { Icon } from "@/components/icon";
import { useEffect, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import Link from "next/link";
import { useLibrary } from "@/lib/store";
import { AmbientOrbs } from "./ambient-orbs";
import { ReaderPanel } from "./reader-panel";
import { ProductPanel } from "./product-panel";
import { Sidebar } from "./sidebar";
import { PANE_PX, type SplitView } from "@/lib/use-split-view";
import type { LinkItem } from "@/lib/types";

/** The full link page: /links/[id]. */
export function LinkDetailView({ linkId }: { linkId: string }) {
  const { links } = useLibrary();
  const link = links.find((l) => l.id === linkId);

  if (!link) notFound();

  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">
      <AmbientOrbs variant={link.contentType === "product" ? "product" : "reader"} />
      {/* Desktop keeps its place in the library while reading; below lg it's the drawer. */}
      <Sidebar />
      <div className="relative flex min-h-screen flex-col lg:pl-[250px]">
        <LinkDetail link={link} />
      </div>
    </div>
  );
}

/** Wide screens: the open link beside the grid, from `?open=<id>`. Esc or ✕ closes it. */
export function DetailPane({ split }: { split: SplitView }) {
  const { links } = useLibrary();
  const link = split.openId ? links.find((l) => l.id === split.openId) : undefined;

  useEffect(() => {
    if (!link) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[aria-modal]")) split.close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (!link) return null;
  return (
    <aside
      aria-label={link.title}
      className="fixed inset-y-0 right-0 z-30 flex flex-col overflow-y-auto overscroll-contain border-l bg-canvas/70"
      style={{
        width: PANE_PX,
        borderColor: "rgb(var(--rim-rgb) / .8)",
        backdropFilter: "blur(24px) saturate(1.3)",
        WebkitBackdropFilter: "blur(24px) saturate(1.3)",
      }}
    >
      {/* Keyed so the note field and panel state start fresh for each link. */}
      <LinkDetail key={link.id} link={link} onClose={split.close} />
    </aside>
  );
}

/** Header actions, note and reader/product panel. `onClose` means it's in the side pane:
 * no breadcrumb or back button, a close and an expand-to-full-page instead. */
function LinkDetail({ link, onClose }: { link: LinkItem; onClose?: () => void }) {
  const { collections, moveLinks, setFavorite, setNote } = useLibrary();
  const router = useRouter();
  const [noteOpen, setNoteOpen] = useState(Boolean(link.note));
  const collection = collections.find((c) => c.id === link.collectionId);
  const isProduct = link.contentType === "product";
  const pane = Boolean(onClose);

  return (
    <>
      <header
        className="sticky top-0 z-30 flex items-center gap-3 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] sm:px-6 sm:py-4"
        style={{
          background: "rgb(var(--surface-rgb) / .45)",
          borderBottom: "1px solid rgb(var(--rim-rgb) / .6)",
          backdropFilter: "blur(24px) saturate(1.3)",
          WebkitBackdropFilter: "blur(24px) saturate(1.3)",
        }}
      >
        {pane && (
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              title="Close (Esc)"
              className="-ml-2 flex h-9 w-9 flex-none items-center justify-center rounded-full text-ink/55 hover:bg-ink/6 hover:text-ink"
            >
              <Icon name="close" size={12} />
            </button>
            <Link
              href={`/links/${link.id}`}
              title="Open as a page"
              className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-ink/55 hover:bg-ink/6 hover:text-ink"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            </Link>
            {collection && <span className="truncate text-[13px] font-semibold text-ink/60">{collection.name}</span>}
          </div>
        )}
        {/* Phones: one back button, to wherever you came from. */}
        {!pane && <button
          type="button"
          onClick={() => (history.length > 1 ? router.back() : router.push(collection ? `/collections/${collection.id}` : "/app"))}
          className="-ml-2 flex h-11 min-w-0 items-center gap-1 px-2 text-[15px] font-semibold text-ink sm:hidden"
        >
          <svg className="flex-none" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
            <path d="m14 6-6 6 6 6" />
          </svg>
          <span className="truncate">Back</span>
        </button>}
        {!pane && <div className="flex min-w-0 items-center gap-2 text-[13px] text-ink/50 max-sm:hidden">
          <Link href="/app" aria-label="Library" className="flex flex-none items-center gap-1.5 hover:text-ink">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <path d="m14 6-6 6 6 6" />
            </svg>
            <span>Library</span>
          </Link>
          {collection && (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ stroke: "rgb(var(--ink-rgb) / .3)" }} strokeWidth="2.6" strokeLinecap="round">
                <path d="m9 6 6 6-6 6" />
              </svg>
              <Link href={`/collections/${collection.id}`} className="truncate font-semibold text-ink hover:underline">
                {collection.name}
              </Link>
              </>
            )}
            {isProduct && (
              <span
                className="ml-1.5 hidden flex-none items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] sm:flex font-semibold text-ink"
                style={{ background: "rgba(124,140,255,.22)" }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-periwinkle" />
                Product detected
              </span>
            )}
          </div>}

          <div className="ml-auto flex flex-none items-center gap-2">
            <button
              type="button"
              data-tour="favorite"
              onClick={() => setFavorite(link.id, !link.favorite)}
              aria-label={link.favorite ? "Remove from favorites" : "Add to favorites"}
              title="Favorite"
              className={`flex h-10 w-10 items-center justify-center rounded-full border border-rim/90 bg-surface/70 text-[15px] sm:h-9 sm:w-9 ${
                link.favorite ? "text-signal" : "text-ink/35"
              }`}
            >
              <Icon name="star" size={15} />
            </button>
            <button
              type="button"
              data-tour="note"
              onClick={() => setNoteOpen((open) => !open)}
              title="Note"
              className={`flex h-10 items-center rounded-full border border-rim/90 bg-surface/70 px-4 text-[12.5px] font-semibold sm:h-9 ${
                link.note ? "text-ink" : "text-ink/70"
              }`}
            >
              Note
            </button>
            <button
              type="button"
              data-tour="open-original"
              onClick={() => window.open(link.url, "_blank", "noopener,noreferrer")}
              className="flex h-9 items-center gap-2 rounded-full border border-rim/90 bg-surface/70 px-4 text-[12.5px] font-semibold text-ink max-sm:hidden"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
              </svg>
              Open{isProduct ? ` on ${link.product?.retailer.split(".")[0]}` : " original"}
            </button>
            <details data-tour="move" className="relative">
              <summary
                className="flex h-10 w-10 list-none items-center justify-center rounded-full border border-rim/90 bg-surface/70 sm:h-9 sm:w-9"
                style={{ cursor: "pointer" }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                  <circle cx="12" cy="5" r="1" />
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="12" cy="19" r="1" />
                </svg>
              </summary>
              <div
                className="absolute right-0 top-11 z-10 w-56 overflow-hidden rounded-[16px] p-1.5"
                style={{ background: "rgb(var(--surface-rgb) / .9)", boxShadow: "var(--shadow-popover)" }}
              >
                <div className="px-2.5 py-1.5 text-eyebrow text-ink/40">Add to collection</div>
                {collections
                  .filter((c) => c.id !== link.collectionId && !c.isSmart)
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => moveLinks([link.id], c.id, true)}
                      className="flex w-full items-center rounded-[10px] px-2.5 py-2 text-left text-[13px] text-ink hover:bg-ink/6"
                    >
                      {c.name}
                    </button>
                  ))}
              </div>
            </details>
          </div>
        </header>

        {noteOpen && (
          <div className="border-b border-rim/60 bg-surface/45 px-4 py-3 sm:px-6">
            <textarea
              autoFocus
              defaultValue={link.note ?? ""}
              onBlur={(e) => setNote(link.id, e.target.value)}
              placeholder="Why you saved this, what to do with it…"
              rows={3}
              className="w-full resize-y rounded-[14px] border border-rim/90 bg-surface/70 px-3.5 py-2.5 text-body text-ink outline-none placeholder:text-ink/35"
            />
          </div>
        )}

        {/* Container queries in the panels: a narrow pane stacks the side rail under the article. */}
        <div className="@container flex flex-1 flex-col">
          {isProduct && link.product ? (
            <ProductPanel link={link} />
          ) : (
            <ReaderPanel link={link} onOpenCollection={() => router.push(`/collections/${link.collectionId}`)} />
          )}
        </div>

        {/* Phones: the one thing you came to do, under the thumb. */}
        <div className="h-24 sm:hidden" />
        <button
          type="button"
          onClick={() => window.open(link.url, "_blank", "noopener,noreferrer")}
          className="fixed inset-x-4 bottom-[max(12px,env(safe-area-inset-bottom))] z-30 flex h-[52px] items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-semibold text-on-ink shadow-[var(--shadow-window)] sm:hidden"
        >
          Open{isProduct ? ` on ${link.product?.retailer.split(".")[0]}` : " original"}
          <Icon name="arrow-up-right" size={15} />
        </button>
    </>
  );
}
