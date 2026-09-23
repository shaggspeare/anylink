"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { moveBefore } from "./organize";

const PICKUP_MS = 300;
const SCROLL_EDGE_PX = 90;

/** A pointer gesture (resize, touch drag) still ends in a click, on this item or whichever
 * one the pointer landed over — eat it. Only for a moment, though: some gestures end
 * without a click, and a lingering listener would swallow the next real tap. */
export function swallowClick() {
  const eat = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };
  window.addEventListener("click", eat, { capture: true, once: true });
  setTimeout(() => window.removeEventListener("click", eat, { capture: true }), 350);
}

/** Drag-to-reorder with a live preview: the list reshuffles while you drag, and every
 * item that changed place slides there (FLIP) instead of jumping.
 *
 * Mouse uses native drag-and-drop. `touch` switches items to a pointer-driven drag —
 * phone browsers' native DnD is too patchy to rely on — where a short hold picks the
 * item up (so a swipe still scrolls) and it then follows the finger.
 * Items spread `item(id)` onto their root element, the list spreads `zone`. */
export function useDragReorder(
  ids: string[],
  onReorder?: (ids: string[]) => void,
  { touch = false }: { touch?: boolean } = {}
) {
  const [preview, setPreview] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  // Both drags retarget on events that repeat for the same item, and moveBefore is a
  // swap next to the target — so only a *new* target moves anything, or items flip-flop.
  const lastOver = useRef<string | null>(null);
  const nodes = useRef(new Map<string, HTMLElement>());
  const offsets = useRef(new Map<string, { x: number; y: number }>());
  // The touch drag runs on window listeners, which would see stale state — so it keeps
  // its live values here. `grab` is where the finger holds the item, relative to it.
  const live = useRef<{
    id: string;
    order: string[];
    finger: { x: number; y: number };
    grab: { x: number; y: number };
  } | null>(null);
  const order = preview ?? ids;

  /** Pins the lifted item under the finger. Measured with its transform cleared, so the
   * offset is from wherever the (reshuffled) layout currently puts it. */
  const follow = () => {
    const d = live.current;
    const el = d && nodes.current.get(d.id);
    if (!d || !el) return;
    el.style.transform = "";
    const r = el.getBoundingClientRect();
    el.style.transform = `translate(${d.finger.x - d.grab.x - r.left}px, ${d.finger.y - d.grab.y - r.top}px) scale(1.05)`;
  };

  // Offsets rather than viewport rects, so scrolling mid-drag doesn't read as movement.
  // Runs on every render on purpose: a resize or a filter reflows the list too.
  useLayoutEffect(() => {
    for (const [id, el] of nodes.current) {
      const next = { x: el.offsetLeft, y: el.offsetTop };
      const prev = offsets.current.get(id);
      offsets.current.set(id, next);
      // The lifted item is placed by the finger, not animated.
      if (id === live.current?.id) continue;
      if (!prev || (prev.x === next.x && prev.y === next.y)) continue;
      el.animate(
        [{ transform: `translate(${prev.x - next.x}px, ${prev.y - next.y}px)` }, { transform: "none" }],
        { duration: 260, easing: "cubic-bezier(.2,.9,.3,1.15)" }
      );
    }
    follow();
  });

  const end = () => {
    setPreview(null);
    setDragId(null);
    lastOver.current = null;
  };

  const retarget = (id: string | null) => {
    const d = live.current;
    if (!d || !id || id === d.id || id === lastOver.current) {
      if (id === d?.id) lastOver.current = null;
      return;
    }
    lastOver.current = id;
    d.order = moveBefore(d.order, d.id, id);
    setPreview(d.order);
  };

  const startTouchDrag = (id: string, e: React.PointerEvent) => {
    const el = nodes.current.get(id);
    // Buttons and links inside an item (menus, checkboxes) keep their own taps.
    if (!el || !onReorder || (e.target as Element).closest("button, a, [role=menu]")) return;
    const start = { x: e.clientX, y: e.clientY };
    let lifted = false;
    let frame = 0;

    const lift = () => {
      lifted = true;
      const r = el.getBoundingClientRect();
      live.current = { id, order: ids, finger: start, grab: { x: start.x - r.left, y: start.y - r.top } };
      el.style.zIndex = "50";
      el.style.pointerEvents = "none"; // so elementFromPoint sees what's *under* it
      el.style.filter = "drop-shadow(0 14px 22px rgba(23,24,27,.22))";
      navigator.vibrate?.(10);
      setDragId(id);
      setPreview(ids);
      follow();
      // Near the top or bottom edge the page scrolls, or long lists couldn't be reordered.
      const tick = () => {
        const d = live.current;
        if (!d) return;
        const { y } = d.finger;
        const dy = y < SCROLL_EDGE_PX ? -10 : y > innerHeight - SCROLL_EDGE_PX ? 10 : 0;
        if (dy) {
          scrollBy(0, dy);
          retarget(hit(d.finger));
          follow();
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };
    const timer = setTimeout(lift, PICKUP_MS);

    const hit = ({ x, y }: { x: number; y: number }) =>
      document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-reorder-id]")?.dataset.reorderId ?? null;

    const move = (ev: PointerEvent) => {
      if (!lifted) {
        // A finger that travels before the hold completes is scrolling.
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 8) cleanup();
        return;
      }
      live.current!.finger = { x: ev.clientX, y: ev.clientY };
      follow();
      retarget(hit(live.current!.finger));
    };
    // Once lifted, the finger drags the item — not the page. Needs a non-passive listener
    // registered before the first move, or the browser has already committed to a scroll.
    const blockScroll = (ev: TouchEvent) => {
      if (lifted) ev.preventDefault();
    };
    const up = () => {
      const d = live.current;
      if (lifted && d) {
        onReorder(d.order);
        swallowClick();
        // Settle from under the finger into the slot, rather than snapping there.
        const from = el.style.transform;
        el.style.transform = "";
        el.animate([{ transform: from }, { transform: "none" }], {
          duration: 220,
          easing: "cubic-bezier(.2,.9,.3,1.15)",
        });
      }
      cleanup();
    };
    const cleanup = () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
      removeEventListener("touchmove", blockScroll);
      if (lifted) {
        el.style.zIndex = el.style.pointerEvents = el.style.filter = "";
        if (live.current?.id === id) el.style.transform = "";
        live.current = null;
        end();
      }
    };
    addEventListener("pointermove", move);
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
    addEventListener("touchmove", blockScroll, { passive: false });
  };

  const item = (id: string) => ({
    "data-reorder-id": id,
    ref: (el: HTMLElement | null) => {
      if (el) nodes.current.set(id, el);
      else {
        nodes.current.delete(id);
        offsets.current.delete(id);
      }
    },
    ...(onReorder &&
      (touch
        ? {
            onPointerDown: (e: React.PointerEvent) => startTouchDrag(id, e),
            // The OS long-press menu would pop up over the pickup.
            onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
          }
        : {
            draggable: true,
            onDragStart: (e: React.DragEvent) => {
              e.stopPropagation();
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", id);
              setDragId(id);
              setPreview(ids);
            },
            onDragEnter: () => {
              if (!dragId || !preview) return;
              if (id === dragId) {
                lastOver.current = null;
                return;
              }
              if (lastOver.current === id) return;
              lastOver.current = id;
              setPreview(moveBefore(preview, dragId, id));
            },
            onDragEnd: end,
          })),
  });

  const zone = {
    onDragOver: (e: React.DragEvent) => {
      if (dragId) e.preventDefault();
    },
    onDrop: (e: React.DragEvent) => {
      if (!dragId || !preview) return;
      e.preventDefault();
      onReorder?.(preview);
      end();
    },
  };

  return { order, dragId, item, zone };
}
