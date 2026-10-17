"use client";

import { useState } from "react";
import { LibraryProvider, useLibrary } from "@/lib/store";
import { searchLinks } from "@/lib/search";
import { sortLinks } from "@/lib/organize";
import { linkCount } from "@/lib/format";
import { CardMosaic } from "@/components/card-mosaic";
import { CollectionMarker } from "@/components/collection-marker";
import { FILTERS } from "@/components/sidebar";
import { Logo } from "@/components/logo";
import type { Breakpoints } from "@/lib/geometry";
import { DEMO_COLLECTIONS, DEMO_LINKS } from "@/lib/demo-library";

/** Landing-page copy of the library: the real mosaic on a demo store, so drag, resize
 *  and favorite all work but nothing leaves the browser. A guest sees their own guest
 *  library here (the same one /app shows); a signed-in visitor gets a throwaway copy.
 *  Styled by app/landing.css; `light` keeps the window in daylight in either theme. */

export function AppDemo() {
  const { guest } = useLibrary();
  if (guest) return <DemoWindow />;
  return (
    <LibraryProvider demo initialLinks={DEMO_LINKS} initialTrashed={[]} initialCollections={DEMO_COLLECTIONS}>
      <DemoWindow />
    </LibraryProvider>
  );
}

// The window's own breakpoints (landing.css): 3 columns beside the sidebar, 2 once it narrows,
// the phone tiles once the sidebar's gone.
const COLUMNS: Breakpoints = [
  [1181, 3],
  [761, 2],
  [0, 1],
];

const ORBS = [
  { left: -120, top: -140, width: 520, height: 520, background: "#ff5a1f", opacity: 0.3 },
  { right: -140, top: 220, width: 560, height: 560, background: "#7c8cff", opacity: 0.28 },
  { left: "38%", bottom: -260, width: 420, height: 420, background: "#d6f24b", opacity: 0.24 },
];

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
  // A guest's Unsorted shows up once they've saved something into it.
  const views = [
    { id: "all", name: "All links", color: "var(--ink)", icon: undefined, count: links.length },
    ...collections.map((c) => ({ ...c, count: links.filter((l) => l.collectionId === c.id).length })),
  ].filter((c) => !("isInbox" in c && c.isInbox && c.count === 0));

  const row = (id: string, label: string, count: number, marker?: React.ReactNode) => (
    <button
      key={id}
      type="button"
      onClick={() => setView(id)}
      aria-pressed={view === id}
      className={view === id ? "sb-row on" : "sb-row"}
    >
      {marker}
      <span className="lbl">{label}</span>
      <span className="n">{count}</span>
    </button>
  );

  return (
    <div className="win light">
      <div className="win-bar">
        <div className="win-dots" aria-hidden>
          <i style={{ background: "#ff5a1f" }} />
          <i style={{ background: "#d6f24b" }} />
          <i style={{ background: "#7c8cff" }} />
        </div>
        <div className="win-url">
          <svg className="ic" viewBox="0 0 24 24" aria-hidden>
            <rect x="5.5" y="10.5" width="13" height="9.5" rx="2.5" />
            <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
          </svg>
          anylink.space/app
        </div>
        <span className="win-live">
          <i aria-hidden />
          Live demo — try it
        </span>
      </div>
      <div className="ui">
        {ORBS.map((o, i) => (
          <span key={i} className="ui-orb" style={o} aria-hidden />
        ))}
        <aside className="sb" aria-label="Collections">
          <div className="sb-brand">
            <Logo className="h-9 w-9" />
            AnyLink
          </div>
          <nav className="sb-nav" aria-label="Library">
            {views.map((c) => row(c.id, c.name, c.count, <CollectionMarker color={c.color} icon={c.icon} />))}
          </nav>
          <div className="sb-eb">Filters</div>
          <div className="sb-nav" style={{ marginTop: 0 }}>
            {filters.map((f) => row(f.query, f.label, f.count))}
          </div>
          <div className="sb-hint">
            <span className="kbd">⌘</span>
            <span className="kbd">V</span>
            <span>pastes a link, anywhere</span>
          </div>
        </aside>
        <div className="main">
          <div className="mh">
            <h3>{title}</h3>
            <span className="cnt">{linkCount(visible.length)}</span>
            <label className="mh-search">
              <svg className="ic" viewBox="0 0 24 24" aria-hidden>
                <circle cx="11" cy="11" r="6.5" />
                <path d="M20 20l-4.2-4.2" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search anything…"
                aria-label="Search the demo library"
              />
              {search && (
                <button type="button" className="s-x" aria-label="Clear search" onClick={() => setSearch("")}>
                  <svg className="ic" viewBox="0 0 24 24" aria-hidden>
                    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
                  </svg>
                </button>
              )}
            </label>
            <a className="mh-add" href="/app">
              + Add
            </a>
          </div>
          {/* Phones get no sidebar — the same views as a swipeable chip row. */}
          <div className="chiprow">
            {views.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setView(c.id)}
                aria-pressed={view === c.id}
                className={view === c.id ? "on" : ""}
              >
                <CollectionMarker color={c.color} icon={c.icon} />
                {c.name}
              </button>
            ))}
          </div>
          <div className="mosaic">
            <CardMosaic links={visible} onReorder={reorderLinks} breakpoints={COLUMNS} />
          </div>
        </div>
      </div>
    </div>
  );
}
