"use client";

import { useColumnCount } from "@/lib/geometry";
import { useDragReorder } from "@/lib/use-drag-reorder";
import { Card } from "./card";
import type { LinkItem } from "@/lib/types";

/** Native drag type for a card, so a sidebar collection can accept it as a move. */
export const LINK_DRAG_TYPE = "application/x-anylink-link";

export function CardMosaic({
  links,
  selectable = false,
  selectedIds,
  onToggleSelect,
  onReorder,
  list = false,
  onOpen,
  openId,
  reservedPx = 0,
}: {
  links: LinkItem[];
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string, e: React.MouseEvent) => void;
  /** Receives the visible ids in their new order after a drag. */
  onReorder?: (ids: string[]) => void;
  /** Phones only: one-line rows instead of the two-up tiles. */
  list?: boolean;
  /** Split view: open a card in the side pane instead of navigating to its page. */
  onOpen?: (id: string) => void;
  /** The card showing in the side pane, outlined. */
  openId?: string | null;
  /** Width the side pane takes from the grid. */
  reservedPx?: number;
}) {
  const columnCount = useColumnCount(reservedPx);
  // Phones get a two-up grid of small uniform tiles instead of one full-width card per row.
  const tile = columnCount === 1;
  const row = tile && list;
  const { order, dragId, item, zone } = useDragReorder(
    links.map((l) => l.id),
    onReorder,
    { touch: tile, dataType: LINK_DRAG_TYPE }
  );
  const byId = new Map(links.map((l) => [l.id, l]));
  // Keep pins ahead even during drag previews and prevent dense packing above them.
  const displayOrder = [...order].sort((a, b) => Number(Boolean(byId.get(b)?.pinned)) - Number(Boolean(byId.get(a)?.pinned)));
  const hasPins = links.some((l) => l.pinned);

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
      className={`grid pb-6 sm:px-5 ${row ? "px-3" : "px-2.5"}`}
      style={{
        gridTemplateColumns: `repeat(${row ? 1 : tile ? 2 : columnCount}, minmax(0, 1fr))`,
        gridAutoRows: "4px",
        gridAutoFlow: hasPins ? "row" : "row dense",
      }}
    >
      {displayOrder.flatMap((id, index) => {
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
            row={row}
            selectable={selectable}
            selectionActive={Boolean(selectedIds && selectedIds.size > 0)}
            selected={selectedIds?.has(id)}
            onSelectClick={(e) => onToggleSelect?.(id, e)}
            dragging={dragId === id && !tile}
            dragProps={item(id)}
            onOpen={onOpen}
            current={openId === id}
          />
        );
      })}
    </div>
  );
}
