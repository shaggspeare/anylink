"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ALL_COLLECTION_ID } from "./mock-data";
import * as actions from "./db/actions";
import { searchLinks } from "./search";
import type { ImportedLink } from "./import/parse";
import type { Priorities } from "./rank/group-links";
import type { CardSize, Collection, LinkItem } from "./types";
import { linkCount } from "./format";

type NewLinkInput = Omit<LinkItem, "id" | "createdAt" | "status" | "archived" | "highlights"> & {
  status?: LinkItem["status"];
};

type LibraryContextValue = {
  links: LinkItem[];
  trashed: LinkItem[];
  collections: Collection[];
  /** Every tag in use, for suggestions and the palette. */
  tags: string[];
  inbox: Collection | undefined;
  addLink: (input: NewLinkInput) => Promise<LinkItem>;
  setLinkSize: (id: string, size: CardSize) => void;
  /** `ids` in their new manual order — the drag-and-drop mosaic's only write. */
  reorderLinks: (ids: string[]) => void;
  reorderCollections: (ids: string[]) => void;
  /** `announce` shows a "Moved to …" toast whose Undo puts each link back where it was. */
  moveLinks: (ids: string[], collectionId: string, announce?: boolean) => void;
  tagLinks: (ids: string[], tag: string) => void;
  archiveLinks: (ids: string[]) => void;
  deleteLinks: (ids: string[]) => void;
  restoreLinks: (ids: string[]) => void;
  purgeLinks: (ids: string[]) => void;
  setFavorite: (id: string, favorite: boolean) => void;
  setNote: (id: string, note: string) => void;
  addCollection: (name: string, color: string) => Promise<Collection>;
  saveSmartCollection: (query: string, name?: string) => Promise<Collection>;
  renameCollection: (id: string, name: string) => void;
  /** Dissolves it: its links go back to Unsorted. `announce` adds a toast whose Undo recreates it. */
  deleteCollection: (id: string, announce?: boolean) => Promise<void>;
  deleteEmptyCollections: () => Promise<number>;
  countForCollection: (collectionId: string) => number;
  addHighlight: (linkId: string, quote: string) => void;
  setAlertThreshold: (linkId: string, threshold: number) => void;
  /** Bulk import from an export file — no crawl, so the whole file lands at once. */
  importLinks: (items: ImportedLink[]) => Promise<actions.ImportLinksResult>;
  /** Onboarding's payoff: files everything unsorted into named collections. */
  groupInbox: (priorities: Priorities) => Promise<actions.GroupedResult[]>;
  logSignal: (action: string, options?: { linkId?: string; collectionId?: string; payload?: unknown }) => void;

  addLinkOpen: boolean;
  addLinkPrefillUrl: string | undefined;
  openAddLink: (prefillUrl?: string) => void;
  closeAddLink: () => void;

  paletteOpen: boolean;
  openPalette: () => void;
  closePalette: () => void;

  /** The sidebar as a slide-in drawer below lg; on desktop it's always shown. */
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  /** One-line confirmation at the bottom of the screen; `undo` adds an Undo button for 5 s. */
  showToast: (message: string, undo?: () => void) => void;
  demo: boolean;
};

type Toast = { message: string; undo?: () => void; key: number };

const LibraryContext = createContext<LibraryContextValue | null>(null);

// Every server action becomes a resolved no-op; the optimistic local updates still run.
const DEMO_ACTIONS = new Proxy({}, { get: () => async () => undefined }) as typeof actions;

let idCounter = 0;
function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

export function LibraryProvider({
  children,
  initialLinks,
  initialTrashed,
  initialCollections,
  demo = false,
}: {
  children: ReactNode;
  initialLinks: LinkItem[];
  initialTrashed: LinkItem[];
  initialCollections: Collection[];
  /** Landing-page demo: state changes stay local, nothing reaches the server. */
  demo?: boolean;
}) {
  const api = demo ? DEMO_ACTIONS : actions;
  const [links, setLinks] = useState<LinkItem[]>(initialLinks);
  const [trashed, setTrashed] = useState<LinkItem[]>(initialTrashed);
  const [collections, setCollections] = useState<Collection[]>(initialCollections);
  const [addLinkOpen, setAddLinkOpen] = useState(false);
  const [addLinkPrefillUrl, setAddLinkPrefillUrl] = useState<string | undefined>(undefined);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const hide = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(hide);
  }, [toast]);

  // Undo runs seconds later; it must act on the library as it is then, not as it was.
  const latest = useRef<LibraryContextValue>(null!);

  const value = useMemo<LibraryContextValue>(
    () => ({
      links,
      trashed,
      collections,
      tags: Array.from(new Set(links.flatMap((l) => l.tags))).sort((a, b) => a.localeCompare(b)),
      inbox: collections.find((c) => c.isInbox),
      addLink: async (input) => {
        const link = await api.createLink(input);
        setLinks((prev) => [link, ...prev]);
        return link;
      },
      setLinkSize: (id, size) => {
        setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, size } : l)));
        api.setLinkSize(id, size).catch(console.error);
      },
      reorderLinks: (ids) => {
        const positions = new Map(ids.map((id, i) => [id, i]));
        setLinks((prev) =>
          prev.map((l) => (positions.has(l.id) ? { ...l, position: positions.get(l.id) } : l))
        );
        api.reorderLinks(ids).catch(console.error);
      },
      moveLinks: (ids, collectionId, announce = false) => {
        const idSet = new Set(ids);
        if (announce) {
          const from = new Map<string, string[]>();
          for (const l of links) {
            if (!idSet.has(l.id) || l.collectionId === collectionId) continue;
            from.set(l.collectionId, [...(from.get(l.collectionId) ?? []), l.id]);
          }
          const name = collections.find((c) => c.id === collectionId)?.name ?? "collection";
          setToast({
            message: ids.length > 1 ? `${linkCount(ids.length)} moved to ${name}` : `Moved to ${name}`,
            undo: () => from.forEach((back, prevId) => latest.current.moveLinks(back, prevId)),
            key: Date.now(),
          });
        }
        setLinks((prev) => prev.map((l) => (idSet.has(l.id) ? { ...l, collectionId } : l)));
        api.moveLinks(ids, collectionId).catch(console.error);
        // Every move is calibration data, wherever in the app it came from — which is
        // why it's logged here rather than at each call site.
        api.logSignal("move", { linkIds: ids, collectionId }).catch(console.error);
      },
      tagLinks: (ids, tag) => {
        const idSet = new Set(ids);
        setLinks((prev) =>
          prev.map((l) =>
            idSet.has(l.id) && !l.tags.includes(tag) ? { ...l, tags: [...l.tags, tag] } : l
          )
        );
        api.tagLinks(ids, tag).catch(console.error);
      },
      archiveLinks: (ids) => {
        const idSet = new Set(ids);
        setLinks((prev) => prev.map((l) => (idSet.has(l.id) ? { ...l, archived: true } : l)));
        api.archiveLinks(ids).catch(console.error);
      },
      deleteLinks: (ids) => {
        const idSet = new Set(ids);
        const moving = links.filter((l) => idSet.has(l.id)).map((l) => ({ ...l, deleted: true }));
        setLinks((prev) => prev.filter((l) => !idSet.has(l.id)));
        setTrashed((prev) => [...moving, ...prev]);
        api.deleteLinks(ids).catch(console.error);
        // Every delete path (tile menu, hover trash, bulk bar) gets the same way back.
        setToast({
          message: ids.length > 1 ? `${linkCount(ids.length)} moved to Trash` : "Moved to Trash",
          undo: () => latest.current.restoreLinks(ids),
          key: Date.now(),
        });
      },
      restoreLinks: (ids) => {
        const idSet = new Set(ids);
        const moving = trashed.filter((l) => idSet.has(l.id)).map((l) => ({ ...l, deleted: false }));
        setTrashed((prev) => prev.filter((l) => !idSet.has(l.id)));
        setLinks((prev) =>
          [...moving, ...prev].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        );
        api.restoreLinks(ids).catch(console.error);
      },
      purgeLinks: (ids) => {
        const idSet = new Set(ids);
        setTrashed((prev) => prev.filter((l) => !idSet.has(l.id)));
        api.purgeLinks(ids).catch(console.error);
      },
      setFavorite: (id, favorite) => {
        setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, favorite } : l)));
        api.setFavorite(id, favorite).catch(console.error);
      },
      setNote: (id, note) => {
        setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, note: note.trim() || undefined } : l)));
        api.setNote(id, note).catch(console.error);
      },
      addCollection: async (name, color) => {
        const collection = await api.createCollection(name, color);
        setCollections((prev) => [...prev, collection]);
        return collection;
      },
      saveSmartCollection: async (query, name) => {
        const collection = await api.createSmartCollection(query, name);
        setCollections((prev) => [...prev, collection]);
        return collection;
      },
      // `ids` is one sidebar group (folders or filters); the rest keep their slots.
      reorderCollections: (ids) => {
        setCollections((prev) => {
          const byId = new Map(prev.map((c) => [c.id, c]));
          const queue = [...ids];
          return prev.map((c) => (ids.includes(c.id) ? byId.get(queue.shift()!)! : c));
        });
        api.reorderCollections(ids).catch(console.error);
      },
      renameCollection: (id, name) => {
        setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
        api.renameCollection(id, name).catch(console.error);
      },
      deleteCollection: async (id, announce = false) => {
        const collection = collections.find((c) => c.id === id);
        const inboxId = collections.find((c) => c.isInbox && !c.isSmart)?.id;
        if (!collection || !inboxId) return;
        await api.deleteCollection(id);
        const memberIds = links.filter((l) => l.collectionId === id).map((l) => l.id);
        const toInbox = (l: LinkItem) => (l.collectionId === id ? { ...l, collectionId: inboxId } : l);
        setLinks((prev) => prev.map(toInbox));
        setTrashed((prev) => prev.map(toInbox));
        setCollections((prev) => prev.filter((c) => c.id !== id));
        if (!announce) return;
        // ponytail: Undo recreates it with a new id at the end of the sidebar (same as iOS);
        // a soft-deleted collection row would keep its id and slot.
        setToast({
          message: collection.isSmart
            ? `“${collection.name}” deleted`
            : `${collection.name} dissolved — ${linkCount(memberIds.length)} back in Unsorted`,
          undo: async () => {
            const lib = latest.current;
            if (collection.isSmart) {
              await lib.saveSmartCollection(collection.smartQuery ?? "", collection.name);
              return;
            }
            const recreated = await lib.addCollection(collection.name, collection.color);
            if (memberIds.length) lib.moveLinks(memberIds, recreated.id);
          },
          key: Date.now(),
        });
      },
      deleteEmptyCollections: async () => {
        const deletedIds = await api.deleteEmptyCollections();
        const idSet = new Set(deletedIds);
        setCollections((prev) => prev.filter((c) => !idSet.has(c.id)));
        return deletedIds.length;
      },
      countForCollection: (collectionId) => {
        if (collectionId === ALL_COLLECTION_ID) return links.filter((l) => !l.archived).length;
        // A custom filter holds no links of its own — its count is whatever its query matches.
        const collection = collections.find((c) => c.id === collectionId);
        if (collection?.isSmart) return searchLinks(links, collection.smartQuery ?? "").length;
        return links.filter((l) => l.collectionId === collectionId && !l.archived).length;
      },
      addHighlight: (linkId, quote) => {
        setLinks((prev) =>
          prev.map((l) =>
            l.id === linkId
              ? { ...l, highlights: [...(l.highlights ?? []), { id: nextId("h"), quote }] }
              : l
          )
        );
        api.addHighlight(linkId, quote).catch(console.error);
      },
      setAlertThreshold: (linkId, threshold) => {
        let currency = "$";
        setLinks((prev) =>
          prev.map((l) => {
            if (l.id !== linkId || !l.product) return l;
            currency = l.product.currency;
            return { ...l, product: { ...l.product, alertThreshold: threshold } };
          })
        );
        api.setAlertThreshold(linkId, threshold, currency).catch(console.error);
      },
      importLinks: async (items) => {
        const result = await api.importLinks(items);
        setLinks((prev) => [...result.links, ...prev]);
        return result;
      },
      groupInbox: async (priorities) => {
        const results = await api.groupInbox(priorities);
        const moves = new Map(
          results.flatMap((r) => r.linkIds.map((id) => [id, r.collection.id] as const))
        );
        setCollections((prev) => [...prev, ...results.map((r) => r.collection)]);
        setLinks((prev) =>
          prev.map((l) => (moves.has(l.id) ? { ...l, collectionId: moves.get(l.id)! } : l))
        );
        return results;
      },
      logSignal: (action, options) => {
        api.logSignal(action, options).catch(console.error);
      },
      addLinkOpen,
      addLinkPrefillUrl,
      openAddLink: (prefillUrl) => {
        setAddLinkPrefillUrl(prefillUrl);
        setAddLinkOpen(true);
      },
      closeAddLink: () => {
        setAddLinkOpen(false);
        setAddLinkPrefillUrl(undefined);
      },
      paletteOpen,
      openPalette: () => setPaletteOpen(true),
      closePalette: () => setPaletteOpen(false),
      menuOpen,
      setMenuOpen,
      showToast: (message, undo) => setToast({ message, undo, key: Date.now() }),
      demo,
    }),
    [links, trashed, collections, addLinkOpen, addLinkPrefillUrl, paletteOpen, menuOpen, api, demo]
  );
  useEffect(() => {
    latest.current = value;
  }, [value]);

  return (
    <LibraryContext.Provider value={value}>
      {children}
      {toast && (
        <div
          key={toast.key}
          role="status"
          className="fixed inset-x-4 bottom-[calc(84px+env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-sm items-center gap-3 rounded-full bg-ink py-2 pl-5 pr-2 text-body text-on-ink shadow-[var(--shadow-popover)] lg:bottom-6"
        >
          <span className="min-w-0 flex-1 truncate">{toast.message}</span>
          {toast.undo && (
            <button
              type="button"
              onClick={() => {
                toast.undo!();
                setToast(null);
              }}
              className="h-9 flex-none rounded-full px-4 font-semibold text-signal"
            >
              Undo
            </button>
          )}
        </div>
      )}
    </LibraryContext.Provider>
  );
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
  return ctx;
}
