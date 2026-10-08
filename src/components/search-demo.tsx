"use client";

import { useState } from "react";
import { LibraryProvider, useLibrary } from "@/lib/store";
import { searchLinks } from "@/lib/search";
import { CardMosaic } from "@/components/card-mosaic";
import { Icon } from "@/components/icon";
import { toDemoLinks } from "@/lib/demo-library";
import type { ContentType } from "@/lib/types";

/** Landing "find that thing": the app's own search over a demo library. */

const LINKS = toDemoLinks([
  ["A visual guide to Barcelona", "https://www.notboring.co/barcelona", "bcn-sunset", "article", ""],
  ["48 hours in Barcelona", "https://www.cntraveler.com/story/48-hours-in-barcelona", "bcn-skyline", "article", ""],
  // Only the page text mentions Barcelona — the point of full-text search.
  ["Best coffee spots", "https://www.eater.com/maps/best-coffee-shops", "coffee", "article", "", {
    articleText: ["Our favourite is a tiny roaster in Barcelona's Gràcia, pouring since 1998."],
  }],
  ["Barcelona photo diary", "https://www.youtube.com/watch?v=barcelona-photo-diary", "bcn-guell", "video", ""],
  ["New Balance 1906R", "https://www.newbalance.com/pd/1906r/M1906R.html", "sneakers", "product", ""],
  ["Leica M6", "https://leica-camera.com/en-int/photography/cameras/m/m6", "", "product", "", {
    heroImage: "/images/collections/everything.webp",
  }],
  ["Tokyo street photography", "https://petapixel.com/tokyo-street-photography", "tokyo", "article", ""],
  ["Ultimate Japan travel guide", "https://www.notion.so/japan-travel-guide", "kyoto", "article", ""],
  ["Dieter Rams: a legendary minimalist", "https://www.youtube.com/watch?v=dieter-rams", "book", "video", ""],
  ["The dreamiest hotels in Portugal", "https://www.cntraveler.com/gallery/best-hotels-in-portugal", "villa", "article", ""],
  ["Home office inspirations", "https://www.pinterest.com/ideas/home-office", "office", "article", ""],
  ["Sunset walks along the beach", "https://www.youtube.com/watch?v=beach-sunset-walks", "barcelona", "video", ""],
]);

const TYPES: { type: ContentType | "all"; label: string }[] = [
  { type: "all", label: "All" },
  { type: "article", label: "Articles" },
  { type: "product", label: "Products" },
  { type: "video", label: "Videos" },
];

export function SearchDemo() {
  return (
    <LibraryProvider demo initialLinks={LINKS} initialTrashed={[]} initialCollections={[]}>
      <SearchBody />
    </LibraryProvider>
  );
}

function SearchBody() {
  const { links } = useLibrary();
  const [query, setQuery] = useState("barcelona");
  const [type, setType] = useState<ContentType | "all">("all");

  const matches = searchLinks(links, query);
  const visible = type === "all" ? matches : matches.filter((l) => l.contentType === type);
  const count = (t: ContentType | "all") => (t === "all" ? matches.length : matches.filter((l) => l.contentType === t).length);

  return (
    <section id="search" className="pt-16 md:pt-24">
      <h2 className="text-display text-[40px] leading-[0.98] sm:text-[56px]">Find that thing. Instantly.</h2>
      <p className="mt-4 max-w-[560px] text-[17px] leading-[1.5] text-ink/55">
        One search for everything — titles, descriptions, and even text inside the page. Filter by type,
        collection or tag.
      </p>

      <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="flex h-14 items-center gap-3 rounded-full bg-surface/80 px-5 shadow-card lg:w-[420px]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="flex-none text-ink/45" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search anything…"
            aria-label="Search the demo library"
            className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-ink/40"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="text-ink/45 hover:text-ink">
              <Icon name="close" size={13} />
            </button>
          )}
        </label>
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
          {TYPES.map((t) => (
            <button
              key={t.type}
              type="button"
              onClick={() => setType(t.type)}
              aria-pressed={type === t.type}
              className={`flex h-11 flex-none items-center gap-2 rounded-full px-5 text-body shadow-card transition-colors sm:h-12 ${
                type === t.type ? "bg-ink text-on-ink" : "bg-surface/80 text-ink/70 hover:text-ink"
              }`}
            >
              {t.label}
              {t.type !== "all" && <span className="text-meta opacity-50">{count(t.type)}</span>}
            </button>
          ))}
        </div>
        {(query || type !== "all") && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setType("all");
            }}
            className="self-start text-body text-ink/55 hover:text-ink lg:ml-auto lg:self-auto"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="-mx-2.5 mt-6 min-h-[280px] sm:min-h-[340px] sm:-mx-5">
        {visible.length ? (
          <CardMosaic links={visible} />
        ) : (
          <p className="px-5 py-24 text-center text-lead text-ink/50">Nothing matches “{query}” — try “japan” or “sneakers”.</p>
        )}
      </div>
    </section>
  );
}
