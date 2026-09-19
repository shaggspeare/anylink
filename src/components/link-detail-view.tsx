"use client";

import { useState } from "react";
import { notFound, useRouter } from "next/navigation";
import Link from "next/link";
import { useLibrary } from "@/lib/store";
import { AmbientOrbs } from "./ambient-orbs";
import { ReaderPanel } from "./reader-panel";
import { ProductPanel } from "./product-panel";

export function LinkDetailView({ linkId }: { linkId: string }) {
  const { links, collections, moveLinks, setFavorite, setNote } = useLibrary();
  const router = useRouter();
  const link = links.find((l) => l.id === linkId);
  const [noteOpen, setNoteOpen] = useState(Boolean(link?.note));

  if (!link) notFound();

  const collection = collections.find((c) => c.id === link.collectionId);
  const isProduct = link.contentType === "product";

  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">
      <AmbientOrbs variant={isProduct ? "product" : "reader"} />
      <div className="relative flex min-h-screen flex-col">
        <header
          className="flex items-center gap-3 px-4 py-4 sm:px-6"
          style={{
            background: "rgba(255,255,255,.45)",
            borderBottom: "1px solid rgba(255,255,255,.6)",
            backdropFilter: "blur(24px) saturate(1.3)",
            WebkitBackdropFilter: "blur(24px) saturate(1.3)",
          }}
        >
          <div className="flex items-center gap-2 text-[13px] text-ink/50">
            <Link href="/app" className="flex items-center gap-1.5 hover:text-ink">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                <path d="m14 6-6 6 6 6" />
              </svg>
              Library
            </Link>
            {collection && (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(23,24,27,.3)" strokeWidth="2.6" strokeLinecap="round">
                  <path d="m9 6 6 6-6 6" />
                </svg>
                <Link href={`/collections/${collection.id}`} className="font-semibold text-ink hover:underline">
                  {collection.name}
                </Link>
              </>
            )}
            {isProduct && (
              <span
                className="ml-1.5 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-ink"
                style={{ background: "rgba(124,140,255,.22)" }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-periwinkle" />
                Product detected
              </span>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              data-tour="favorite"
              onClick={() => setFavorite(link.id, !link.favorite)}
              aria-label={link.favorite ? "Remove from favorites" : "Add to favorites"}
              title="Favorite"
              className={`flex h-9 w-9 items-center justify-center rounded-full border border-white/90 bg-white/70 text-[15px] ${
                link.favorite ? "text-signal" : "text-ink/35"
              }`}
            >
              ★
            </button>
            <button
              type="button"
              data-tour="note"
              onClick={() => setNoteOpen((open) => !open)}
              title="Note"
              className={`flex h-9 items-center rounded-full border border-white/90 bg-white/70 px-4 text-[12.5px] font-semibold ${
                link.note ? "text-ink" : "text-ink/45"
              }`}
            >
              Note
            </button>
            <button
              type="button"
              data-tour="open-original"
              onClick={() => window.open(link.url, "_blank", "noopener,noreferrer")}
              className="flex h-9 items-center gap-2 rounded-full border border-white/90 bg-white/70 px-4 text-[12.5px] font-semibold text-ink"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
              </svg>
              Open {isProduct ? `on ${link.product?.retailer.split(".")[0]}` : "original"}
            </button>
            <details data-tour="move" className="relative">
              <summary
                className="flex h-9 w-9 list-none items-center justify-center rounded-full border border-white/90 bg-white/70"
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
                style={{ background: "rgba(255,255,255,.9)", boxShadow: "var(--shadow-popover)" }}
              >
                <div className="px-2.5 py-1.5 text-eyebrow text-ink/40">Add to collection</div>
                {collections
                  .filter((c) => c.id !== link.collectionId && !c.isSmart)
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => moveLinks([link.id], c.id)}
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
          <div className="border-b border-white/60 bg-white/45 px-4 py-3 sm:px-6">
            <textarea
              autoFocus
              defaultValue={link.note ?? ""}
              onBlur={(e) => setNote(link.id, e.target.value)}
              placeholder="Why you saved this, what to do with it…"
              rows={3}
              className="w-full resize-y rounded-[14px] border border-white/90 bg-white/70 px-3.5 py-2.5 text-body text-ink outline-none placeholder:text-ink/35"
            />
          </div>
        )}

        {isProduct && link.product ? (
          <ProductPanel link={link} />
        ) : (
          <ReaderPanel link={link} onOpenCollection={() => router.push(`/collections/${link.collectionId}`)} />
        )}
      </div>
    </div>
  );
}
