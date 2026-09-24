"use client";

import { Icon } from "@/components/icon";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLibrary } from "@/lib/store";
import { Sidebar } from "@/components/sidebar";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { CardMosaic } from "@/components/card-mosaic";
import { AmbientOrbs } from "@/components/ambient-orbs";
import { PasteHint } from "@/components/paste-hint";
import { SortSelect } from "@/components/sort-select";
import { searchLinks } from "@/lib/search";
import { sortLinks, type Sort } from "@/lib/organize";

export default function LibraryPage() {
  const { links, reorderLinks, openAddLink, openPalette } = useLibrary();
  const router = useRouter();
  const [sort, setSort] = useState<Sort>("newest");
  // Every sidebar filter and saved search lands here as `?q=…` — one query language,
  // no per-filter view state. searchLinks also drops archived links on its own.
  const query = useSearchParams().get("q") ?? "";
  const visible = sortLinks(searchLinks(links, query), sort);

  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">
      <AmbientOrbs variant="library" />
      <Sidebar />
      <div className="relative lg:pl-[250px]">
        <header className="flex items-end gap-3.5 px-4 pb-4 pt-6 sm:px-5 lg:px-6.5">
          <h1 className="text-hero whitespace-nowrap text-[30px]">All links</h1>
          <div className="flex min-w-0 items-center gap-2 pb-1.5">
            <span className="whitespace-nowrap text-meta text-ink/50">{visible.length} links</span>
            {query ? (
              <button
                type="button"
                onClick={() => router.push("/app")}
                title="Clear filter"
                className="flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-1 font-mono text-[11px] text-on-ink"
              >
                {query}
                <Icon name="close" size={10} className="text-on-ink/60" />
              </button>
            ) : (
              <>
                <span className="hidden h-1 w-1 rounded-full bg-ink/25 sm:inline" />
                <span className="hidden text-meta text-ink/50 sm:inline">
                  drag cards to arrange, corners to resize
                </span>
              </>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2 pb-1">
            <SortSelect value={sort} onChange={setSort} />
            <button
              type="button"
              data-tour="search"
              onClick={openPalette}
              className="hidden h-10 items-center gap-2 rounded-full border border-rim/80 bg-surface/70 px-4 text-body text-ink/60 sm:flex"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              Search
              <kbd className="rounded-[5px] bg-ink/6 px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
            </button>
            <button
              type="button"
              data-tour="add"
              onClick={() => openAddLink()}
              className="hidden h-10 items-center gap-1.5 rounded-full bg-ink px-4.5 sm:flex text-body font-semibold text-on-ink"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add
            </button>
          </div>
        </header>

        {links.length === 0 ? (
          <div className="glass-55 mx-4 flex flex-col items-start gap-3 rounded-[27px] p-7 sm:mx-5 lg:mx-6.5">
            <h2 className="text-title">Start with the links you already have</h2>
            <p className="max-w-[440px] text-lead text-ink/55">
              Import your browser bookmarks or your Telegram saved messages. Dead links get
              stripped out and the rest come back grouped by what you actually care about.
            </p>
            <a
              href="/start"
              className="flex h-11 items-center rounded-full bg-ink px-5 text-body font-semibold text-on-ink"
            >
              Import my links
            </a>
          </div>
        ) : (
          /* ponytail: one position per link, so dragging inside a filtered view reshuffles
             the global order too. Per-view ordering would need a row per (view, link). */
          <>
            <CardMosaic
              links={visible}
              // Dragging works in any sort; the drop saves what you see and flips to
              // "My order" so the arrangement doesn't snap straight back.
              onReorder={(ids) => {
                reorderLinks(ids);
                setSort("manual");
              }}
            />
            <PasteHint wide />
          </>
        )}
        <div className="h-[calc(6rem+env(safe-area-inset-bottom))] lg:hidden" />
      </div>
      <BottomTabBar />
    </div>
  );
}
