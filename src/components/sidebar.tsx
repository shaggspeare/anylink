"use client";

import { Icon } from "@/components/icon";
import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Logo } from "./logo";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLibrary } from "@/lib/store";
import { useDragReorder } from "@/lib/use-drag-reorder";
import { CollectionMarker } from "./collection-marker";
import { TourButton } from "./tour";
import { PasteHint } from "./paste-hint";
import { ALL_COLLECTION_ID } from "@/lib/mock-data";
import { searchLinks } from "@/lib/search";
import { suggestThemes } from "@/lib/organize";
import type { Collection } from "@/lib/types";
import { ThemeToggle } from "@/components/theme-toggle";

const SWATCHES = ["#ff5a1f", "#d6f24b", "#7c8cff", "#9aa3ad", "#e0855a"];

/** Candidate filters, in sidebar order. Each is just a query string — one that
 * matches nothing is never rendered, so the list always mirrors the library. */
const FILTERS: { label: string; query: string }[] = [
  { label: "Favorites", query: "is:favorite" },
  { label: "Articles", query: "type:article" },
  { label: "Videos", query: "type:video" },
  { label: "Products", query: "type:product" },
  { label: "With a note", query: "is:noted" },
  { label: "Untagged", query: "is:untagged" },
  { label: "Duplicates", query: "is:duplicate" },
  { label: "Broken links", query: "is:broken" },
  { label: "Archived", query: "is:archived" },
];

const MAX_SIDEBAR_TAGS = 12;
const DISMISSED_THEMES_KEY = "anylink:dismissed-themes";

/** Theme suggestions you've waved off, kept in localStorage. useSyncExternalStore because
 * the server can't read it — a render-time read would be a hydration mismatch. */
const dismissedListeners = new Set<() => void>();

function useDismissedThemes(): [string[], (name: string) => void] {
  const raw = useSyncExternalStore(
    (notify) => {
      dismissedListeners.add(notify);
      return () => {
        dismissedListeners.delete(notify);
      };
    },
    () => localStorage.getItem(DISMISSED_THEMES_KEY) ?? "",
    () => ""
  );

  const dismiss = (name: string) => {
    localStorage.setItem(DISMISSED_THEMES_KEY, [raw, name].filter(Boolean).join(","));
    dismissedListeners.forEach((notify) => notify());
  };

  return [useMemo(() => raw.split(",").filter(Boolean), [raw]), dismiss];
}

export function Sidebar() {
  const {
    links,
    trashed,
    collections,
    countForCollection,
    addCollection,
    saveSmartCollection,
    deleteEmptyCollections,
    reorderCollections,
    menuOpen,
    setMenuOpen,
  } = useLibrary();
  const pathname = usePathname();
  const activeQuery = useSearchParams().get("q") ?? "";
  const [creating, setCreating] = useState(false);
  const [dismissedThemes, dismissTheme] = useDismissedThemes();

  const isAllActive = pathname === "/app" && !activeQuery;

  // A real collection holds links; a smart one is a saved query. They read as different
  // things in the sidebar, so they're listed apart.
  // The inbox stays pinned on top; everything else in each group can be dragged.
  const inbox = collections.find((c) => c.isInbox && !c.isSmart);
  const folders = collections.filter((c) => !c.isSmart && !c.isInbox);
  const customFilters = collections.filter((c) => c.isSmart);
  const byId = new Map(collections.map((c) => [c.id, c]));
  const folderDrag = useDragReorder(folders.map((c) => c.id), reorderCollections);
  const filterDrag = useDragReorder(customFilters.map((c) => c.id), reorderCollections);

  const themes = useMemo(
    () => suggestThemes(links, collections).filter((t) => !dismissedThemes.includes(t.name)),
    [links, collections, dismissedThemes]
  );

  const filters = useMemo(
    () =>
      FILTERS.map((f) => ({ ...f, count: searchLinks(links, f.query).length })).filter(
        (f) => f.count > 0
      ),
    [links]
  );

  // ponytail: top 12 tags by use, no "show all" — revisit if a library outgrows that.
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const link of links) {
      if (link.archived) continue;
      for (const tag of link.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, MAX_SIDEBAR_TAGS);
  }, [links]);

  return (
    <>
    {menuOpen && (
      <button
        type="button"
        aria-label="Close menu"
        onClick={() => setMenuOpen(false)}
        className="fixed inset-0 z-40 bg-ink/25 lg:hidden"
      />
    )}
    <aside
      // Any link inside navigates away, so the drawer closes behind it.
      onClick={(e) => (e.target as HTMLElement).closest("a") && setMenuOpen(false)}
      className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-none flex-col overflow-y-auto overscroll-contain border-r px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(20px,env(safe-area-inset-top))] transition-transform duration-300 lg:z-20 lg:w-[250px] lg:translate-x-0 max-lg:bg-canvas! max-lg:shadow-[var(--shadow-window)] ${
        menuOpen ? "translate-x-0" : "-translate-x-full"
      }`}
      style={{
        background: "rgb(var(--surface-rgb) / .55)",
        borderColor: "rgb(var(--rim-rgb) / .8)",
        backdropFilter: "blur(24px) saturate(1.4)",
        WebkitBackdropFilter: "blur(24px) saturate(1.4)",
      }}
    >
      <div className="flex items-center gap-2 px-2 py-2">
        <Logo className="h-12 w-12 lg:h-11 lg:w-11" />
        <span className="text-wordmark">AnyLink</span>
        <ThemeToggle className="ml-auto" />
      </div>

      <nav data-tour="sidebar" className="mt-4 flex flex-col gap-0.5">
        <Link
          href="/app"
          className="flex items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-body transition-colors"
          style={{ background: isAllActive ? "rgb(var(--ink-rgb) / .06)" : "transparent" }}
        >
          <CollectionMarker color="var(--ink)" />
          <span className="flex-1 truncate">All links</span>
          <span className="text-meta text-ink/45">{countForCollection(ALL_COLLECTION_ID)}</span>
        </Link>
        {inbox && (
          <CollectionRow collection={inbox} count={countForCollection(inbox.id)} active={pathname === `/collections/${inbox.id}`} />
        )}
        <div {...folderDrag.zone} className="flex flex-col gap-0.5">
          {folderDrag.order.flatMap((id) => {
            const c = byId.get(id);
            if (!c) return [];
            return (
              <CollectionRow
                key={id}
                collection={c}
                count={countForCollection(id)}
                active={pathname === `/collections/${id}`}
                dragging={folderDrag.dragId === id}
                dragProps={folderDrag.item(id)}
              />
            );
          })}
        </div>
      </nav>

      <div className="mt-1 flex-1 overflow-y-auto">
        {creating ? (
          <NewCollectionForm
            onCreate={async (name, color) => {
              await addCollection(name, color);
              setCreating(false);
            }}
            onCancel={() => setCreating(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex w-full items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-body text-ink/50 hover:bg-ink/6 hover:text-ink"
          >
            <span className="flex h-4 w-4 items-center justify-center text-[14px] leading-none">+</span>
            New collection
          </button>
        )}
        {/* A full page load: /start imports, checks and re-groups, so the library it
            comes back to has to be read fresh from the database. */}
        <a
          href="/start"
          data-tour="import"
          className="flex w-full items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-body text-ink/50 hover:bg-ink/6 hover:text-ink"
        >
          <span className="flex h-4 w-4 items-center justify-center"><Icon name="arrow-down" size={13} /></span>
          Import links
        </a>
        <CleanUpCollectionsButton onRun={deleteEmptyCollections} />

        {filters.length > 0 && (
          <div data-tour="filters">
            <div className="mt-4 px-3 py-1.5 text-eyebrow text-ink/40">Filters</div>
            {filters.map((f) => (
              <FilterRow
                key={f.query}
                label={f.label}
                query={f.query}
                count={f.count}
                active={activeQuery === f.query}
              />
            ))}
          </div>
        )}

        {customFilters.length > 0 && (
          <div data-tour="custom-filters" {...filterDrag.zone}>
            <div className="mt-4 px-3 py-1.5 text-eyebrow text-ink/40">Custom filters</div>
            {filterDrag.order.flatMap((id) => {
              const c = byId.get(id);
              if (!c) return [];
              return (
                <CollectionRow
                  key={id}
                  collection={c}
                  count={countForCollection(id)}
                  active={pathname === `/collections/${id}`}
                  dragging={filterDrag.dragId === id}
                  dragProps={filterDrag.item(id)}
                />
              );
            })}
          </div>
        )}

        {themes.length > 0 && (
          <div data-tour="themes">
            <div className="mt-4 px-3 py-1.5 text-eyebrow text-ink/40">Suggested collections</div>
            {themes.map((theme) => (
              <div
                key={theme.query}
                className="group flex items-center gap-2 rounded-[14px] px-3 py-2 text-body text-ink/65 hover:bg-ink/6"
              >
                <span className="min-w-0 flex-1 truncate">{theme.name}</span>
                <span className="text-meta text-ink/45 group-hover:hidden">{theme.count}</span>
                <button
                  type="button"
                  onClick={() => saveSmartCollection(theme.query, theme.name)}
                  title={`Collect the ${theme.count} links tagged ${theme.query}`}
                  className="hidden rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold text-on-ink group-hover:block"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => dismissTheme(theme.name)}
                  aria-label={`Dismiss ${theme.name}`}
                  className="hidden h-5 w-5 flex-none items-center justify-center rounded-full text-ink/40 hover:bg-surface hover:text-ink group-hover:flex"
                >
                  <Icon name="close" size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {tags.length > 0 && (
          /* Collapsed by default — the tag list is the longest section and it pushes
             everything below it out of view. */
          <details data-tour="tags" className="group">
            <summary className="mt-4 flex cursor-pointer items-center gap-1.5 px-3 py-1.5 text-eyebrow text-ink/40 marker:content-[''] hover:text-ink/60">
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="flex-none transition-transform group-open:rotate-90"
              >
                <path d="m9 5 7 7-7 7" />
              </svg>
              Tags
              <span className="ml-auto normal-case tracking-normal">{tags.length}</span>
            </summary>
            {tags.map(([tag, count]) => (
              <FilterRow
                key={tag}
                label={`#${tag}`}
                query={`#${tag}`}
                count={count}
                active={activeQuery === `#${tag}`}
              />
            ))}
          </details>
        )}

        {trashed.length > 0 && (
          <Link
            data-tour="trash"
            href="/trash"
            className="mt-4 flex items-center gap-2.5 rounded-[14px] px-3 py-2 text-body text-ink/55 hover:bg-ink/6 hover:text-ink"
            style={{ background: pathname === "/trash" ? "rgb(var(--ink-rgb) / .06)" : undefined }}
          >
            <span className="flex h-4 w-4 items-center justify-center text-[13px] leading-none">⌫</span>
            <span className="flex-1 truncate">Trash</span>
            <span className="text-meta text-ink/45">{trashed.length}</span>
          </Link>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <TourButton />
      </div>

      <PasteHint />
    </aside>
    </>
  );
}

function FilterRow({
  label,
  query,
  count,
  active,
}: {
  label: string;
  query: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={`/app?q=${encodeURIComponent(query)}`}
      className="flex items-center gap-2.5 rounded-[14px] px-3 py-2 text-body text-ink/65 hover:bg-ink/6 hover:text-ink"
      style={{ background: active ? "rgb(var(--ink-rgb) / .06)" : "transparent" }}
    >
      <span className="flex-1 truncate">{label}</span>
      <span className="text-meta text-ink/45">{count}</span>
    </Link>
  );
}

function CleanUpCollectionsButton({ onRun }: { onRun: () => Promise<number> }) {
  const [removed, setRemoved] = useState<number | null>(null);

  return (
    <button
      type="button"
      data-tour="cleanup"
      onClick={async () => setRemoved(await onRun())}
      className="flex w-full items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-body text-ink/50 hover:bg-ink/6 hover:text-ink"
    >
      <span className="flex h-4 w-4 items-center justify-center text-[13px] leading-none">⌦</span>
      {removed === null ? "Delete empty collections" : `Removed ${removed}`}
    </button>
  );
}

function NewCollectionForm({
  onCreate,
  onCancel,
}: {
  onCreate: (name: string, color: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    await onCreate(name.trim(), color);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-2 rounded-[14px] bg-ink/6 p-2.5"
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
        placeholder="Collection name"
        className="h-8 rounded-[10px] border border-ink/10 bg-surface px-2.5 text-[12.5px] text-ink outline-none"
      />
      <div className="flex items-center gap-1.5 px-0.5">
        {SWATCHES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setColor(s)}
            aria-label={s}
            className="h-5 w-5 rounded-full"
            style={{
              background: s,
              boxShadow: s === color ? "0 0 0 2px var(--ink), 0 0 0 3px rgb(var(--surface-rgb) / .9)" : undefined,
            }}
          />
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={onCancel} className="rounded-full px-2.5 py-1 text-[11.5px] text-ink/50 hover:text-ink">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || saving}
            className="rounded-full bg-ink px-3 py-1 text-[11.5px] font-semibold text-on-ink disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>
    </form>
  );
}

function CollectionRow({
  collection,
  count,
  active,
  dragging = false,
  dragProps,
}: {
  collection: Collection;
  count: number;
  active: boolean;
  dragging?: boolean;
  dragProps?: ReturnType<ReturnType<typeof useDragReorder>["item"]>;
}) {
  const { renameCollection, deleteCollection } = useLibrary();
  const router = useRouter();
  const pathname = usePathname();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(collection.name);
  const [error, setError] = useState<string | null>(null);

  const submitRename = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== collection.name) renameCollection(collection.id, trimmed);
    setRenaming(false);
  };

  const handleDelete = async () => {
    setError(null);
    try {
      await deleteCollection(collection.id);
      if (pathname === `/collections/${collection.id}`) router.push("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete this collection.");
    }
  };

  if (renaming) {
    return (
      <div className="flex items-center gap-2.5 rounded-[14px] px-3 py-2">
        <CollectionMarker color={collection.color} />
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={submitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitRename();
            if (e.key === "Escape") {
              setName(collection.name);
              setRenaming(false);
            }
          }}
          className="h-6 min-w-0 flex-1 rounded-[8px] border border-ink/15 bg-surface px-1.5 text-[12.5px] text-ink outline-none"
        />
      </div>
    );
  }

  return (
    <div
      {...dragProps}
      data-tour={collection.isInbox ? "inbox" : undefined}
      // No text selection or iOS link callout: a held row is being picked up.
      className={`group relative flex select-none items-center rounded-[14px] [-webkit-touch-callout:none] ${dragProps && "draggable" in dragProps ? "cursor-grab active:cursor-grabbing" : ""}`}
      style={{ background: active ? "rgb(var(--ink-rgb) / .06)" : "transparent", opacity: dragging ? 0.35 : 1 }}
    >
      {/* Not draggable itself — otherwise the browser drags the URL instead of the row. */}
      <Link
        href={`/collections/${collection.id}`}
        draggable={false}
        className="flex flex-1 items-center gap-2.5 px-3 py-2.5 text-body"
      >
        <CollectionMarker color={collection.color} />
        <span className="flex-1 truncate">{collection.name}</span>
        <span className="text-meta text-ink/45 group-hover:hidden">{count}</span>
      </Link>
      {!collection.isInbox && (
        <div className="absolute right-1.5 hidden items-center gap-0.5 group-hover:flex">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setRenaming(true);
            }}
            aria-label="Rename"
            className="flex h-6 w-6 items-center justify-center rounded-full text-ink/45 hover:bg-surface hover:text-ink"
          >
            <Icon name="pencil" size={12} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            aria-label="Delete"
            title={count > 0 ? `Delete — ${count} link${count > 1 ? "s" : ""} move to Trash` : "Delete"}
            className="flex h-6 w-6 items-center justify-center rounded-full text-ink/45 hover:bg-surface hover:text-ink"
          >
            <Icon name="close" size={11} />
          </button>
        </div>
      )}
      {error && (
        <div className="absolute left-0 top-full z-10 mt-1 w-full rounded-[10px] bg-ink px-2.5 py-1.5 text-[11px] text-on-ink">
          {error}
        </div>
      )}
    </div>
  );
}
