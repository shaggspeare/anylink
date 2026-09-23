"use client";

import { useColumnCount } from "@/lib/geometry";
import { useDragReorder } from "@/lib/use-drag-reorder";
import { Card } from "./card";
import type { LinkItem } from "@/lib/types";

export function CardMosaic({
  links,
  selectable = false,
  selectedIds,
  onToggleSelect,
  onReorder,
}: {
  links: LinkItem[];
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string, e: React.MouseEvent) => void;
  /** Receives the visible ids in their new order after a drag. */
  onReorder?: (ids: string[]) => void;
}) {
  const columnCount = useColumnCount();
  // Phones get a two-up grid of small uniform tiles instead of one full-width card per row.
  const tile = columnCount === 1;
  const { order, dragId, item, zone } = useDragReorder(
    links.map((l) => l.id),
    onReorder,
    { touch: tile }
  );
  const byId = new Map(links.map((l) => [l.id, l]));

  if (links.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink/6">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ stroke: "rgb(var(--ink-rgb) / .4)" }} strokeWidth="2.4" strokeLinecap="round">
            <path d="M9.5 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
            <path d="M14.5 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
          </svg>
        </div>
        <div className="text-title">Nothing here yet</div>
        <div className="max-w-[320px] text-body text-ink/55">
          Paste a URL to save your first link into this collection.
        </div>
      </div>
    );
  }

  return (
    <div
      data-tour="mosaic"
      {...zone}
      className="grid px-2.5 pb-6 sm:px-5"
      style={{
        gridTemplateColumns: `repeat(${tile ? 2 : columnCount}, minmax(0, 1fr))`,
        gridAutoRows: "4px",
        gridAutoFlow: "row dense",
      }}
    >
      {order.flatMap((id, index) => {
        // A link can vanish mid-drag (deleted in another tab), so skip what's gone.
        const link = byId.get(id);
        if (!link) return [];
        return (
          <Card
            key={id}
            index={index}
            link={link}
            columnCount={columnCount}
            tile={tile}
            selectable={selectable}
            selectionActive={Boolean(selectedIds && selectedIds.size > 0)}
            selected={selectedIds?.has(id)}
            onSelectClick={(e) => onToggleSelect?.(id, e)}
            dragging={dragId === id && !tile}
            dragProps={item(id)}
          />
        );
      })}
    </div>
  );
}
