"use client";

import { useEffect, useState } from "react";
import type { CardSize } from "./types";

/** [column span, row height in px] per size, at the 4-column desktop grid. */
export const CARD_GEOMETRY: Record<CardSize, { cols: number; rowPx: number }> = {
  S: { cols: 1, rowPx: 180 },
  M: { cols: 1, rowPx: 300 },
  L: { cols: 2, rowPx: 300 },
};

/** Phone tile height — every size collapses to this so the two-up grid stays even. */
export const TILE_PX = 132;

export const CARD_TITLE_SIZE: Record<CardSize, number> = { S: 17, M: 19, L: 27 };

export const GRID_ROW_UNIT = 4;

const BREAKPOINTS: [number, number][] = [
  [1280, 4],
  [900, 3],
  [640, 2],
  [0, 1],
];

export function columnsForWidth(width: number) {
  for (const [min, cols] of BREAKPOINTS) {
    if (width >= min) return cols;
  }
  return 1;
}

/** Tracks how many mosaic columns are active at the current viewport width. */
export function useColumnCount() {
  const [cols, setCols] = useState(4);
  useEffect(() => {
    const update = () => setCols(columnsForWidth(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return cols;
}

/** Ports the mockup's drag-resize snap rule: wide past ~1.45 columns snaps to L,
 * otherwise a tall drag becomes M, anything smaller settles back to S. */
export function sizeFromDrag(widthPx: number, heightPx: number, unitPx: number): CardSize {
  if (widthPx > unitPx * 1.45) return "L";
  if (heightPx > 245) return "M";
  return "S";
}

/** A finger travel reads as a swipe only if it's long enough and clearly sideways —
 * otherwise it's a scroll that drifted. */
export function swipeDirection(dx: number, dy: number): "left" | "right" | null {
  if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) return null;
  return dx > 0 ? "right" : "left";
}
