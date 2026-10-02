"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icon";
import { useLibrary } from "@/lib/store";
import type { LinkItem } from "@/lib/types";

const ROW = "flex h-12 w-full items-center gap-3 rounded-[14px] px-3.5 text-left text-[15px] font-medium text-ink active:bg-ink/8";

/** Phone actions for one link: an iOS-style sheet from the bottom, where the thumb already is.
 * Portalled to <body> — the card's backdrop-filter would otherwise trap `position: fixed`. */
export function LinkActionSheet({ link, onClose }: { link: LinkItem; onClose: () => void }) {
  const { collections, moveLinks, setFavorite, deleteLinks, showToast } = useLibrary();
  const [moving, setMoving] = useState(false);
  const targets = collections.filter((c) => !c.isSmart && c.id !== link.collectionId);
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const run = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return createPortal(
    // React bubbles events out of a portal to the card, so taps here would also open the
    // link or start a tile drag.
    <div
      className="fixed inset-0 z-[55] flex items-end"
      role="dialog"
      aria-modal
      aria-label={`Actions for ${link.title}`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/30" />
      <div
        className="relative w-full rounded-t-[28px] px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2"
        style={{ background: "var(--paper)", boxShadow: "var(--shadow-window)", animation: "sheet-in .28s cubic-bezier(.2,.9,.3,1)" }}
      >
        <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-ink/15" />
        <div className="mb-1 flex items-center gap-2.5 px-3.5 pb-2">
          <span
            className="flex h-6 w-6 flex-none items-center justify-center rounded-[7px] text-[10px] font-bold"
            style={{ color: link.stripe, background: link.tint }}
          >
            {link.initial}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold text-ink">{link.title}</div>
            <div className="truncate text-meta text-ink/50">{link.domain}</div>
          </div>
        </div>

        {moving ? (
          <div className="flex max-h-[50dvh] flex-col overflow-y-auto">
            <button type="button" onClick={() => setMoving(false)} className={`${ROW} text-ink/55`}>
              <Icon name="arrow-left" size={14} /> Move to…
            </button>
            {targets.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={run(() => {
                  moveLinks([link.id], c.id);
                  showToast(`Moved to ${c.name}`);
                })}
                className={ROW}
              >
                <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: c.color }} />
                {c.name}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col">
            <a href={link.url} target="_blank" rel="noreferrer noopener" onClick={onClose} className={ROW}>
              <Icon name="arrow-up-right" size={15} /> Open original
            </a>
            {canShare && (
              <button
                type="button"
                onClick={run(() => navigator.share({ title: link.title, url: link.url }).catch(() => {}))}
                className={ROW}
              >
                <Icon name="share" size={15} /> Share…
              </button>
            )}
            <button
              type="button"
              onClick={run(() =>
                navigator.clipboard?.writeText(link.url).then(
                  () => showToast("Link copied"),
                  () => showToast("Couldn't copy the link")
                )
              )}
              className={ROW}
            >
              <Icon name="link" size={15} /> Copy link
            </button>
            {targets.length > 0 && (
              <button type="button" onClick={() => setMoving(true)} className={ROW}>
                <Icon name="folder" size={15} /> Move to collection
              </button>
            )}
            <button type="button" onClick={run(() => setFavorite(link.id, !link.favorite))} className={ROW}>
              <span className="text-signal"><Icon name="star" size={15} /></span>
              {link.favorite ? "Remove from favorites" : "Add to favorites"}
            </button>
            <button type="button" onClick={run(() => deleteLinks([link.id]))} className={`${ROW} text-red-500`}>
              <Icon name="trash" size={15} /> Move to Trash
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
