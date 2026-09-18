"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLibrary } from "@/lib/store";
import { Sidebar } from "@/components/sidebar";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { CardMosaic } from "@/components/card-mosaic";
import { AmbientOrbs } from "@/components/ambient-orbs";
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
          <h1 className="text-hero text-[30px] sm:text-title lg:text-[30px]">All links</h1>
          <div className="flex items-center gap-2 pb-1.5">
            <span className="text-meta text-ink/50">{visible.length} links</span>
            {query ? (
              <button
                type="button"
                onClick={() => router.push("/")}
                title="Clear filter"
                className="flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-1 font-mono text-[11px] text-[#f4f5f6]"
              >
                {query}
                <span className="text-[#f4f5f6]/60">✕</span>
              </button>
            ) : (
              <>
                <span className="h-1 w-1 rounded-full bg-ink/25" />
                <span className="hidden text-meta text-ink/50 sm:inline">
                  {sort === "manual" ? "drag cards to arrange them" : "drag a card corner to resize"}
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
              className="hidden h-10 items-center gap-2 rounded-full border border-white/80 bg-white/70 px-4 text-body text-ink/60 sm:flex"
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
              className="flex h-10 items-center gap-1.5 rounded-full bg-ink px-4.5 text-body font-semibold text-[#f4f5f6]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add
            </button>
          </div>
        </header>

        {/* ponytail: one position per link, so dragging inside a filtered view reshuffles
            the global order too. Per-view ordering would need a row per (view, link). */}
        <CardMosaic links={visible} onReorder={sort === "manual" ? reorderLinks : undefined} />
        <div className="h-24 lg:hidden" />
      </div>
      <BottomTabBar />
    </div>
  );
}
