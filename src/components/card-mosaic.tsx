"use client";

import { useColumnCount } from "@/lib/geometry";
import { Card } from "./card";
import type { LinkItem } from "@/lib/types";

export function CardMosaic({
  links,
  selectable = false,
  selectedIds,
  onToggleSelect,
}: {
  links: LinkItem[];
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string, e: React.MouseEvent) => void;
}) {
  const columnCount = useColumnCount();

  if (links.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink/6">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(23,24,27,.4)" strokeWidth="2.4" strokeLinecap="round">
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
      className="grid px-4 pb-6 sm:px-5"
      style={{
        gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
        gridAutoRows: "4px",
        gridAutoFlow: "row dense",
      }}
    >
      {links.map((link) => (
        <Card
          key={link.id}
          link={link}
          columnCount={columnCount}
          selectable={selectable}
          selectionActive={Boolean(selectedIds && selectedIds.size > 0)}
          selected={selectedIds?.has(link.id)}
          onSelectClick={(e) => onToggleSelect?.(link.id, e)}
        />
      ))}
    </div>
  );
}
