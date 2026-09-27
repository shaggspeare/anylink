"use client";

import { useState } from "react";
import { LibraryProvider, useLibrary } from "@/lib/store";
import { searchLinks } from "@/lib/search";
import { sortLinks } from "@/lib/organize";
import { identityForDomain } from "@/lib/card-identity";
import { CardMosaic } from "@/components/card-mosaic";
import { CollectionMarker } from "@/components/collection-marker";
import { FILTERS } from "@/components/sidebar";
import { Logo } from "@/components/logo";
import type { Collection, ContentType, LinkItem } from "@/lib/types";

/** Landing-page copy of the library: the real mosaic on a demo store, so drag, resize
 *  and favorite all work but nothing leaves the browser. Photos: Unsplash. */

const COLLECTIONS: Collection[] = [
  { id: "reading", name: "Reading", color: "var(--signal-orange)" },
  { id: "inspiration", name: "Inspiration", color: "#e0855a" },
  { id: "shopping", name: "Shopping", color: "var(--periwinkle)" },
  { id: "travel", name: "Travel", color: "var(--lime)" },
  { id: "watch", name: "Watch later", color: "var(--slate)" },
];

export type DemoRow = [
  title: string,
  url: string,
  image: string,
  type: ContentType,
  collectionId: string,
  extra?: Partial<LinkItem>,
];

const DEMO: DemoRow[] = [
  ["The dreamiest hotels in Portugal", "https://www.cntraveler.com/gallery/best-hotels-in-portugal", "villa", "article", "travel"],
  ["New Balance 1906R", "https://www.newbalance.com/pd/1906r/M1906R.html", "sneakers", "product", "shopping"],
  ["A visual guide to Barcelona", "https://www.notboring.co/barcelona", "barcelona", "article", "travel"],
  ["Dieter Rams: a legendary minimalist", "https://www.youtube.com/watch?v=dieter-rams", "book", "video", "watch"],
  ["Good coffee at home", "https://sprudge.com/good-coffee-at-home", "coffee", "article", "reading"],
  ["Tokyo street photography", "https://petapixel.com/tokyo-street-photography", "tokyo", "article", "inspiration"],
  ["Home office inspirations", "https://www.pinterest.com/ideas/home-office", "office", "article", "inspiration"],
  ["Ultimate Japan travel guide", "https://www.notion.so/japan-travel-guide", "kyoto", "article", "travel"],
];

/** Demo rows → full LinkItems; `image` is a file name in /public/images/demo. */
export function toDemoLinks(rows: DemoRow[]): LinkItem[] {
  return rows.map(([title, url, image, contentType, collectionId, extra], i) => {
    const domain = new URL(url).hostname.replace(/^www\./, "");
    return {
      id: `demo-${i}`,
      url,
      domain,
      title,
      excerpt: "",
      heroImage: `/images/demo/${image}.webp`,
      ...identityForDomain(domain),
      contentType,
      collectionId,
      tags: [],
      size: "M",
      status: "ready",
      createdAt: new Date(2026, 8, 20 - i).toISOString(),
      ...extra,
    };
  });
}

const LINKS = toDemoLinks(DEMO);

export function AppDemo() {
  return (
    <LibraryProvider demo initialLinks={LINKS} initialTrashed={[]} initialCollections={COLLECTIONS}>
      <DemoWindow />
    </LibraryProvider>
  );
}

function DemoWindow() {
  const { links, collections, reorderLinks } = useLibrary();
  // "all", a collection id, or a sidebar filter query — the same shapes the real app routes on.
  const [view, setView] = useState("all");
  const [search, setSearch] = useState("");

  const inView =
    view === "all"
      ? links
      : collections.some((c) => c.id === view)
        ? links.filter((l) => l.collectionId === view)
        : searchLinks(links, view);
  const visible = sortLinks(searchLinks(inView, search), "manual");
  const filters = FILTERS.map((f) => ({ ...f, count: searchLinks(links, f.query).length })).filter((f) => f.count > 0);
  const title =
    collections.find((c) => c.id === view)?.name ?? FILTERS.find((f) => f.query === view)?.label ?? "All links";

  const row = (id: string, label: string, count: number, color?: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setView(id)}
      className={`flex w-full items-center gap-2.5 rounded-[14px] px-3 py-2 text-body transition-colors hover:bg-ink/6 ${
        view === id ? "bg-ink/6" : "text-ink/65"
      }`}
    >
      {color && <CollectionMarker color={color} />}
      <span className="flex-1 truncate text-left">{label}</span>
      <span className="text-meta text-ink/45">{count}</span>
    </button>
  );

  return (
    <div className="glass-42 flex overflow-hidden rounded-panel shadow-window">
      <aside className="hidden w-[230px] flex-none flex-col border-r border-rim/80 bg-surface/55 p-4 md:flex">
        <div className="flex items-center gap-2 px-2 py-1">
          <Logo className="h-9 w-9" />
          <span className="text-wordmark">AnyLink</span>
        </div>
        <nav className="mt-4 flex flex-col gap-0.5">
          {row("all", "All links", links.length, "var(--ink)")}
          {collections.map((c) => row(c.id, c.name, links.filter((l) => l.collectionId === c.id).length, c.color))}
        </nav>
        <div className="mt-4 px-3 py-1.5 text-eyebrow text-ink/40">Filters</div>
        {filters.map((f) => row(f.query, f.label, f.count))}
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex items-end gap-3 px-4 pt-5 pb-4 sm:px-6">
          <h3 className="text-hero text-[26px] whitespace-nowrap">{title}</h3>
          <span className="pb-1 text-meta whitespace-nowrap text-ink/50">{visible.length} links</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search anything…"
            aria-label="Search the demo library"
            className="ml-auto hidden h-10 w-[220px] rounded-full border border-rim/80 bg-surface/70 px-4 text-body outline-none placeholder:text-ink/40 sm:block"
          />
          <a
            href="/app"
            className="flex h-10 items-center gap-1.5 rounded-full bg-ink px-4.5 text-body font-semibold text-on-ink max-sm:ml-auto"
          >
            + Add
          </a>
        </header>
        {/* Phones get no sidebar — the same views as a swipeable chip row. */}
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] md:hidden">
          {[{ id: "all", name: "All links", color: "var(--ink)" }, ...collections].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setView(c.id)}
              aria-pressed={view === c.id}
              className={`flex h-9 flex-none items-center gap-2 rounded-full px-3.5 text-body transition-colors ${
                view === c.id ? "bg-ink text-on-ink" : "bg-ink/6 text-ink/70"
              }`}
            >
              <CollectionMarker color={c.color} />
              {c.name}
            </button>
          ))}
        </div>
        <div className="sm:h-[620px] sm:overflow-y-auto">
          <CardMosaic links={visible} onReorder={reorderLinks} />
        </div>
      </div>
    </div>
  );
}
