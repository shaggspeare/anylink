"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { ALL_COLLECTION_ID } from "./mock-data";
import * as actions from "./db/actions";
import { searchLinks } from "./search";
import type { ImportedLink } from "./import/parse";
import type { Priorities } from "./rank/group-links";
import type { CardSize, Collection, LinkItem } from "./types";

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
  moveLinks: (ids: string[], collectionId: string) => void;
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
  deleteCollection: (id: string) => Promise<void>;
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
};

const LibraryContext = createContext<LibraryContextValue | null>(null);

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
}: {
  children: ReactNode;
  initialLinks: LinkItem[];
  initialTrashed: LinkItem[];
  initialCollections: Collection[];
}) {
  const [links, setLinks] = useState<LinkItem[]>(initialLinks);
  const [trashed, setTrashed] = useState<LinkItem[]>(initialTrashed);
  const [collections, setCollections] = useState<Collection[]>(initialCollections);
  const [addLinkOpen, setAddLinkOpen] = useState(false);
  const [addLinkPrefillUrl, setAddLinkPrefillUrl] = useState<string | undefined>(undefined);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const value = useMemo<LibraryContextValue>(
    () => ({
      links,
      trashed,
      collections,
      tags: Array.from(new Set(links.flatMap((l) => l.tags))).sort((a, b) => a.localeCompare(b)),
      inbox: collections.find((c) => c.isInbox),
      addLink: async (input) => {
        const link = await actions.createLink(input);
        setLinks((prev) => [link, ...prev]);
        return link;
      },
      setLinkSize: (id, size) => {
        setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, size } : l)));
        actions.setLinkSize(id, size).catch(console.error);
      },
      reorderLinks: (ids) => {
        const positions = new Map(ids.map((id, i) => [id, i]));
        setLinks((prev) =>
          prev.map((l) => (positions.has(l.id) ? { ...l, position: positions.get(l.id) } : l))
        );
        actions.reorderLinks(ids).catch(console.error);
      },
      moveLinks: (ids, collectionId) => {
        const idSet = new Set(ids);
        setLinks((prev) => prev.map((l) => (idSet.has(l.id) ? { ...l, collectionId } : l)));
        actions.moveLinks(ids, collectionId).catch(console.error);
        // Every move is calibration data, wherever in the app it came from — which is
        // why it's logged here rather than at each call site.
        actions.logSignal("move", { linkIds: ids, collectionId }).catch(console.error);
      },
      tagLinks: (ids, tag) => {
        const idSet = new Set(ids);
        setLinks((prev) =>
          prev.map((l) =>
            idSet.has(l.id) && !l.tags.includes(tag) ? { ...l, tags: [...l.tags, tag] } : l
          )
        );
        actions.tagLinks(ids, tag).catch(console.error);
      },
      archiveLinks: (ids) => {
        const idSet = new Set(ids);
        setLinks((prev) => prev.map((l) => (idSet.has(l.id) ? { ...l, archived: true } : l)));
        actions.archiveLinks(ids).catch(console.error);
      },
      deleteLinks: (ids) => {
        const idSet = new Set(ids);
        const moving = links.filter((l) => idSet.has(l.id)).map((l) => ({ ...l, deleted: true }));
        setLinks((prev) => prev.filter((l) => !idSet.has(l.id)));
        setTrashed((prev) => [...moving, ...prev]);
        actions.deleteLinks(ids).catch(console.error);
      },
      restoreLinks: (ids) => {
        const idSet = new Set(ids);
        const moving = trashed.filter((l) => idSet.has(l.id)).map((l) => ({ ...l, deleted: false }));
        setTrashed((prev) => prev.filter((l) => !idSet.has(l.id)));
        setLinks((prev) =>
          [...moving, ...prev].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        );
        actions.restoreLinks(ids).catch(console.error);
      },
      purgeLinks: (ids) => {
        const idSet = new Set(ids);
        setTrashed((prev) => prev.filter((l) => !idSet.has(l.id)));
        actions.purgeLinks(ids).catch(console.error);
      },
      setFavorite: (id, favorite) => {
        setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, favorite } : l)));
        actions.setFavorite(id, favorite).catch(console.error);
      },
      setNote: (id, note) => {
        setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, note: note.trim() || undefined } : l)));
        actions.setNote(id, note).catch(console.error);
      },
      addCollection: async (name, color) => {
        const collection = await actions.createCollection(name, color);
        setCollections((prev) => [...prev, collection]);
        return collection;
      },
      saveSmartCollection: async (query, name) => {
        const collection = await actions.createSmartCollection(query, name);
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
        actions.reorderCollections(ids).catch(console.error);
      },
      renameCollection: (id, name) => {
        setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
        actions.renameCollection(id, name).catch(console.error);
      },
      deleteCollection: async (id) => {
        const { trashedIds } = await actions.deleteCollection(id);
        const idSet = new Set(trashedIds);
        const moving = links.filter((l) => idSet.has(l.id)).map((l) => ({ ...l, deleted: true }));
        setLinks((prev) => prev.filter((l) => !idSet.has(l.id)));
        setTrashed((prev) => [...moving, ...prev]);
        setCollections((prev) => prev.filter((c) => c.id !== id));
      },
      deleteEmptyCollections: async () => {
        const deletedIds = await actions.deleteEmptyCollections();
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
        actions.addHighlight(linkId, quote).catch(console.error);
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
        actions.setAlertThreshold(linkId, threshold, currency).catch(console.error);
      },
      importLinks: async (items) => {
        const result = await actions.importLinks(items);
        setLinks((prev) => [...result.links, ...prev]);
        return result;
      },
      groupInbox: async (priorities) => {
        const results = await actions.groupInbox(priorities);
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
        actions.logSignal(action, options).catch(console.error);
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
    }),
    [links, trashed, collections, addLinkOpen, addLinkPrefillUrl, paletteOpen, menuOpen]
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
  return ctx;
}
