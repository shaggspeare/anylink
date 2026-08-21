"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { ALL_COLLECTION_ID } from "./mock-data";
import * as actions from "./db/actions";
import type { CardSize, Collection, LinkItem } from "./types";

type NewLinkInput = Omit<LinkItem, "id" | "createdAt" | "status" | "archived" | "highlights"> & {
  status?: LinkItem["status"];
};

type LibraryContextValue = {
  links: LinkItem[];
  collections: Collection[];
  addLink: (input: NewLinkInput) => Promise<LinkItem>;
  setLinkSize: (id: string, size: CardSize) => void;
  moveLinks: (ids: string[], collectionId: string) => void;
  tagLinks: (ids: string[], tag: string) => void;
  archiveLinks: (ids: string[]) => void;
  deleteLinks: (ids: string[]) => void;
  addCollection: (name: string, color: string) => Promise<Collection>;
  saveSmartCollection: (query: string) => Promise<Collection>;
  renameCollection: (id: string, name: string) => void;
  deleteCollection: (id: string) => Promise<void>;
  countForCollection: (collectionId: string) => number;
  addHighlight: (linkId: string, quote: string) => void;
  setAlertThreshold: (linkId: string, threshold: number) => void;
  importBookmark: (url: string, title: string, collectionId: string) => Promise<actions.ImportBookmarkResult>;

  addLinkOpen: boolean;
  addLinkPrefillUrl: string | undefined;
  openAddLink: (prefillUrl?: string) => void;
  closeAddLink: () => void;

  paletteOpen: boolean;
  openPalette: () => void;
  closePalette: () => void;
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
  initialCollections,
}: {
  children: ReactNode;
  initialLinks: LinkItem[];
  initialCollections: Collection[];
}) {
  const [links, setLinks] = useState<LinkItem[]>(initialLinks);
  const [collections, setCollections] = useState<Collection[]>(initialCollections);
  const [addLinkOpen, setAddLinkOpen] = useState(false);
  const [addLinkPrefillUrl, setAddLinkPrefillUrl] = useState<string | undefined>(undefined);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const value = useMemo<LibraryContextValue>(
    () => ({
      links,
      collections,
      addLink: async (input) => {
        const link = await actions.createLink(input);
        setLinks((prev) => [link, ...prev]);
        return link;
      },
      setLinkSize: (id, size) => {
        setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, size } : l)));
        actions.setLinkSize(id, size).catch(console.error);
      },
      moveLinks: (ids, collectionId) => {
        const idSet = new Set(ids);
        setLinks((prev) => prev.map((l) => (idSet.has(l.id) ? { ...l, collectionId } : l)));
        actions.moveLinks(ids, collectionId).catch(console.error);
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
        setLinks((prev) => prev.filter((l) => !idSet.has(l.id)));
        actions.deleteLinks(ids).catch(console.error);
      },
      addCollection: async (name, color) => {
        const collection = await actions.createCollection(name, color);
        setCollections((prev) => [...prev, collection]);
        return collection;
      },
      saveSmartCollection: async (query) => {
        const collection = await actions.createSmartCollection(query);
        setCollections((prev) => [...prev, collection]);
        return collection;
      },
      renameCollection: (id, name) => {
        setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
        actions.renameCollection(id, name).catch(console.error);
      },
      deleteCollection: async (id) => {
        await actions.deleteCollection(id);
        setCollections((prev) => prev.filter((c) => c.id !== id));
      },
      countForCollection: (collectionId) => {
        if (collectionId === ALL_COLLECTION_ID) return links.filter((l) => !l.archived).length;
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
      importBookmark: async (url, title, collectionId) => {
        const result = await actions.importBookmark(url, title, collectionId);
        if (result.ok) setLinks((prev) => [result.link, ...prev]);
        return result;
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
    }),
    [links, collections, addLinkOpen, addLinkPrefillUrl, paletteOpen]
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
  return ctx;
}
