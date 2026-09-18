"use client";

import { useMemo, useState } from "react";
import { notFound } from "next/navigation";
import { useLibrary } from "@/lib/store";
import { Sidebar } from "@/components/sidebar";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { CardMosaic } from "@/components/card-mosaic";
import { AmbientOrbs } from "@/components/ambient-orbs";
import { CollectionMarker } from "@/components/collection-marker";
import { Chip } from "@/components/chip";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { SortSelect } from "@/components/sort-select";
import { searchLinks } from "@/lib/search";
import { sortLinks, type Sort } from "@/lib/organize";

export function CollectionView({ collectionId }: { collectionId: string }) {
  const { links, collections, tags, moveLinks, tagLinks, archiveLinks, deleteLinks, reorderLinks } =
    useLibrary();
  const collection = collections.find((c) => c.id === collectionId);

  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("newest");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastIndex, setLastIndex] = useState<number | null>(null);

  const scoped = useMemo(() => {
    if (!collection) return [];
    // A smart collection is its saved query, re-run through the same operator-aware
    // matcher the palette and sidebar use; searchLinks drops archived links either way.
    return collection.isSmart
      ? searchLinks(links, collection.smartQuery ?? "")
      : searchLinks(links.filter((l) => l.collectionId === collectionId), "");
  }, [links, collection, collectionId]);

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    scoped.forEach((l) => l.tags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [scoped]);

  const visible = useMemo(
    () => sortLinks(tagFilter ? scoped.filter((l) => l.tags.includes(tagFilter)) : scoped, sort),
    [scoped, tagFilter, sort]
  );

  if (!collection) notFound();

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    const index = visible.findIndex((l) => l.id === id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (e.shiftKey && lastIndex !== null) {
        const [from, to] = [Math.min(lastIndex, index), Math.max(lastIndex, index)];
        for (let i = from; i <= to; i++) next.add(visible[i].id);
      } else if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setLastIndex(index);
  };

  const clearSelection = () => setSelectedIds(new Set());
  const withClear = (fn: (ids: string[]) => void) => {
    fn(Array.from(selectedIds));
    clearSelection();
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">
      <AmbientOrbs variant="library" />
      <Sidebar />
      <div className="relative lg:pl-[250px]">
        <header className="flex flex-col gap-3 px-4 pb-4 pt-6 sm:px-5 lg:px-6.5">
          <div data-tour="collection-header" className="flex items-center gap-3">
            <CollectionMarker color={collection.color} size={14} />
            <h1 className="text-title text-[26px]">{collection.name}</h1>
            <span className="text-meta text-ink/50">{scoped.length} links</span>
            {collection.isSmart && (
              <span className="rounded-full bg-ink/6 px-2.5 py-1 font-mono text-[11px] text-ink/55">
                {collection.smartQuery}
              </span>
            )}
            {sort === "manual" && (
              <span className="hidden text-meta text-ink/45 sm:inline">drag cards to arrange</span>
            )}
          </div>
          {/* Only collections AnyLink built have one — it's the "grouped because…" line
              from the import, kept where the collection lives rather than shown once. */}
          {collection.reasoning && (
            <p data-tour="collection-reasoning" className="max-w-[560px] text-lead text-ink/50">
              {collection.reasoning}
            </p>
          )}
          <div data-tour="collection-filters" className="flex flex-wrap items-center gap-2">
            <Chip active={tagFilter === null} onClick={() => setTagFilter(null)}>
              All
            </Chip>
            {availableTags.map((t) => (
              <Chip key={t} active={tagFilter === t} onClick={() => setTagFilter(tagFilter === t ? null : t)}>
                {t}
              </Chip>
            ))}
            <span className="ml-auto">
              <SortSelect value={sort} onChange={setSort} />
            </span>
          </div>
        </header>

        <CardMosaic
          links={visible}
          selectable
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onReorder={sort === "manual" ? reorderLinks : undefined}
        />
        <div className="h-24 lg:hidden" />
      </div>

      <BulkActionBar
        count={selectedIds.size}
        collections={collections}
        tags={tags}
        onMove={(id) => withClear((ids) => moveLinks(ids, id))}
        onTag={(tag) => withClear((ids) => tagLinks(ids, tag))}
        onArchive={() => withClear(archiveLinks)}
        onDelete={() => withClear(deleteLinks)}
        onClear={clearSelection}
      />
      <BottomTabBar />
    </div>
  );
}
