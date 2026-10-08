"use client";

import { useState } from "react";
import { LibraryProvider, useLibrary } from "@/lib/store";
import { searchLinks } from "@/lib/search";
import { sortLinks } from "@/lib/organize";
import { CardMosaic } from "@/components/card-mosaic";
import { CollectionMarker } from "@/components/collection-marker";
import { FILTERS } from "@/components/sidebar";
import { Logo } from "@/components/logo";
import { DEMO_COLLECTIONS, DEMO_LINKS } from "@/lib/demo-library";

/** Landing-page copy of the library: the real mosaic on a demo store, so drag, resize
 *  and favorite all work but nothing leaves the browser. A guest sees their own guest
 *  library here (the same one /app shows); a signed-in visitor gets a throwaway copy. */

export function AppDemo() {
  const { guest } = useLibrary();
  if (guest) return <DemoWindow />;
  return (
    <LibraryProvider demo initialLinks={DEMO_LINKS} initialTrashed={[]} initialCollections={DEMO_COLLECTIONS}>
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
          {collections.map((c) => {
            const count = links.filter((l) => l.collectionId === c.id).length;
            // A guest's Unsorted shows up once they've saved something into it.
            return c.isInbox && count === 0 ? null : row(c.id, c.name, count, c.color);
          })}
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
