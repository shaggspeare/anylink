"use client";

import { useEffect, useState } from "react";

/** Select mode for a card grid: click toggles, shift-click selects the range from the last
 * click. `withClear` runs a bulk action on the selection and then empties it. */
export function useSelection(visible: { id: string }[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastIndex, setLastIndex] = useState<number | null>(null);

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

  // Esc leaves select mode, unless a menu or dialog is open and Esc is closing that.
  const selecting = selectedIds.size > 0;
  useEffect(() => {
    if (!selecting) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[aria-modal]")) setSelectedIds(new Set());
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selecting]);
  const withClear = (fn: (ids: string[]) => void) => {
    fn(Array.from(selectedIds));
    clearSelection();
  };

  return { selectedIds, toggleSelect, clearSelection, withClear };
}
