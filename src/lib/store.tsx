"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { collections as seedCollections, links as seedLinks, ALL_COLLECTION_ID } from "./mock-data";
import type { CardSize, Collection, LinkItem } from "./types";

type NewLinkInput = Omit<LinkItem, "id" | "createdAt" | "status"> & { status?: LinkItem["status"] };

type LibraryContextValue = {
  links: LinkItem[];
  collections: Collection[];
  addLink: (input: NewLinkInput) => LinkItem;
  setLinkSize: (id: string, size: CardSize) => void;
  moveLinks: (ids: string[], collectionId: string) => void;
  tagLinks: (ids: string[], tag: string) => void;
  archiveLinks: (ids: string[]) => void;
  deleteLinks: (ids: string[]) => void;
  addCollection: (name: string, color: string) => Collection;
  saveSmartCollection: (query: string) => Collection;
  countForCollection: (collectionId: string) => number;
  addHighlight: (linkId: string, quote: string) => void;
  setAlertThreshold: (linkId: string, threshold: number) => void;

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

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [links, setLinks] = useState<LinkItem[]>(seedLinks);
  const [collections, setCollections] = useState<Collection[]>(seedCollections);
  const [addLinkOpen, setAddLinkOpen] = useState(false);
  const [addLinkPrefillUrl, setAddLinkPrefillUrl] = useState<string | undefined>(undefined);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const value = useMemo<LibraryContextValue>(
    () => ({
      links,
      collections,
      addLink: (input) => {
        const link: LinkItem = {
          ...input,
          id: nextId("l"),
          createdAt: new Date().toISOString(),
          status: input.status ?? "ready",
        };
        setLinks((prev) => [link, ...prev]);
        return link;
      },
      setLinkSize: (id, size) => {
        setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, size } : l)));
      },
      moveLinks: (ids, collectionId) => {
        const idSet = new Set(ids);
        setLinks((prev) => prev.map((l) => (idSet.has(l.id) ? { ...l, collectionId } : l)));
      },
      tagLinks: (ids, tag) => {
        const idSet = new Set(ids);
        setLinks((prev) =>
          prev.map((l) =>
            idSet.has(l.id) && !l.tags.includes(tag) ? { ...l, tags: [...l.tags, tag] } : l
          )
        );
      },
      archiveLinks: (ids) => {
        const idSet = new Set(ids);
        setLinks((prev) => prev.map((l) => (idSet.has(l.id) ? { ...l, archived: true } : l)));
      },
      deleteLinks: (ids) => {
        const idSet = new Set(ids);
        setLinks((prev) => prev.filter((l) => !idSet.has(l.id)));
      },
      addCollection: (name, color) => {
        const collection: Collection = { id: nextId("c"), name, color };
        setCollections((prev) => [...prev, collection]);
        return collection;
      },
      saveSmartCollection: (query) => {
        const collection: Collection = {
          id: nextId("c"),
          name: query,
          color: "#7c8cff",
          isSmart: true,
          smartQuery: query,
        };
        setCollections((prev) => [...prev, collection]);
        return collection;
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
      },
      setAlertThreshold: (linkId, threshold) => {
        setLinks((prev) =>
          prev.map((l) => (l.id === linkId && l.product ? { ...l, product: { ...l.product, alertThreshold: threshold } } : l))
        );
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
