"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLibrary } from "@/lib/store";
import { swipeDirection } from "@/lib/geometry";

function TabIcon({ d }: { d: string }) {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const LIST_VIEW_KEY = "anylink:list-view";
const listViewListeners = new Set<() => void>();

/** Phone library layout: tiles or one-line rows. Kept in localStorage so it survives
 * reloads; useSyncExternalStore keeps the tab bar and the mosaic in step. */
export function useListView(): [boolean, () => void] {
  const list = useSyncExternalStore(
    (notify) => {
      listViewListeners.add(notify);
      return () => {
        listViewListeners.delete(notify);
      };
    },
    () => localStorage.getItem(LIST_VIEW_KEY) === "1",
    () => false
  );
  const toggle = () => {
    localStorage.setItem(LIST_VIEW_KEY, list ? "0" : "1");
    listViewListeners.forEach((notify) => notify());
  };
  return [list, toggle];
}

export function BottomTabBar() {
  const pathname = usePathname();
  const { openAddLink, openPalette, setMenuOpen, menuOpen, addLinkOpen, paletteOpen } = useLibrary();
  const isLibrary = pathname === "/app";
  const [list, toggleList] = useListView();

  // Phone gestures: swipe right pulls in the sidebar, swipe left opens "Add a link"
  // (or just closes the sidebar if it's out). Lives here because this bar is the
  // phone-only chrome every library page already renders.
  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    let start: { x: number; y: number } | null = null;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      start = e.touches.length === 1 && !inHorizontalScroller(e.target) ? { x: t.clientX, y: t.clientY } : null;
    };
    const onEnd = (e: TouchEvent) => {
      if (!start) return;
      const t = e.changedTouches[0];
      const dir = swipeDirection(t.clientX - start.x, t.clientY - start.y);
      start = null;
      if (!dir || addLinkOpen || paletteOpen) return;
      if (dir === "right") setMenuOpen(true);
      else if (menuOpen) setMenuOpen(false);
      else openAddLink();
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [menuOpen, addLinkOpen, paletteOpen, setMenuOpen, openAddLink]);

  // iOS 26 tab bar: icon over a short label, all tabs one tint. Press squishes the tab
  // like Liquid Glass does instead of flashing a background.
  const itemClass = (display = "flex") =>
    `${display} h-[50px] min-w-0 flex-1 flex-col items-center justify-center gap-[3px] rounded-full text-ink/75 transition-transform duration-200 active:scale-90`;
  const label = "text-[10px] font-medium leading-none tracking-[-.01em]";

  return (
    <nav className="fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-30 flex items-center gap-2.5 lg:hidden">
      <div className="flex min-w-0 flex-1 items-center rounded-full px-1 py-[3px]" style={GLASS}>
        <button type="button" onClick={() => setMenuOpen(true)} className={itemClass()}>
          <TabIcon d="M4 6h16M4 12h16M4 18h16" />
          <span className={label}>Menu</span>
        </button>
        {/* Already on the library (phone widths), this tab folds the tiles into one-line
            rows and back; from anywhere else it just goes to All links. */}
        {isLibrary && (
          <button type="button" onClick={toggleList} className={itemClass("flex sm:hidden")} aria-pressed={list}>
            {/* Chevrons say what a tap does: pointing apart unfolds the rows, together squashes the tiles. */}
            <TabIcon d={list ? "M7 15l5 5 5-5M7 9l5-5 5 5" : "M7 20l5-5 5 5M7 4l5 5 5-5"} />
            <span className={label}>{list ? "Expand" : "Squash"}</span>
          </button>
        )}
        <Link href="/app" className={itemClass(isLibrary ? "hidden sm:flex" : "flex")}>
          <TabIcon d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
          <span className={label}>Links</span>
        </Link>
        <button type="button" onClick={openPalette} className={itemClass()}>
          <TabIcon d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16ZM21 21l-4.3-4.3" />
          <span className={label}>Search</span>
        </button>
      </div>
      {/* The primary action floats on its own glass bubble, accent-tinted, like iOS 26's
          search/compose button beside the tab bar. */}
      <button
        type="button"
        onClick={() => openAddLink()}
        className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-signal text-doc-shell transition-transform duration-200 active:scale-90"
        style={{ ...GLASS, background: undefined }}
        aria-label="Add a link"
      >
        <TabIcon d="M12 5v14M5 12h14" />
      </button>
    </nav>
  );
}

/** Liquid Glass: thin translucent fill, heavy blur with boosted saturation so content
 * colour bleeds through, a specular top highlight and a soft lift shadow. */
const GLASS = {
  background: "rgb(var(--surface-rgb) / .42)",
  border: "1px solid rgb(var(--rim-rgb) / .55)",
  backdropFilter: "blur(20px) saturate(1.8)",
  WebkitBackdropFilter: "blur(20px) saturate(1.8)",
  boxShadow:
    "inset 0 1px 0 rgb(255 255 255 / .45), inset 0 -1px 1px rgb(0 0 0 / .05), var(--shadow-popover)",
} as const;

/** The tag-chip row scrolls sideways on its own — a swipe there is a scroll, not a gesture. */
function inHorizontalScroller(target: EventTarget | null) {
  for (let el = target as HTMLElement | null; el; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth && /auto|scroll/.test(getComputedStyle(el).overflowX)) return true;
  }
  return false;
}
