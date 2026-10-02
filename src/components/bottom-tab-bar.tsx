"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLibrary } from "@/lib/store";
import { swipeDirection } from "@/lib/geometry";
import { Icon } from "@/components/icon";

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
  const [hidden, setHidden] = useState(false);
  const [list, toggleList] = useListView();

  // Phone gestures: swipe right opens the sidebar, swipe left opens "Add a link" (or just
  // closes the sidebar if it's out). Lives here because this bar is the phone-only chrome
  // every library page already renders.
  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    let start: { x: number; y: number } | null = null;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      // A swipe from the very edge is the browser's Back gesture, not ours.
      const edge = t.clientX < 24 || t.clientX > window.innerWidth - 24;
      start = e.touches.length === 1 && !edge && !inHorizontalScroller(e.target) ? { x: t.clientX, y: t.clientY } : null;
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

  // Out of the way while scrolling down through cards, back the moment you scroll up.
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) < 8) return;
      setHidden(y > last && y > 80);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // iOS 26 tab bar: icon over a short label; the current section is tinted. Press squishes
  // the tab like Liquid Glass does instead of flashing a background.
  const itemClass = (active: boolean) =>
    `flex h-[50px] min-w-0 flex-1 flex-col items-center justify-center gap-[3px] rounded-full transition-transform duration-200 active:scale-90 ${
      active ? "text-signal" : "text-ink/65"
    }`;
  const label = "text-[10px] font-semibold leading-none tracking-[-.01em]";
  const inCollections = menuOpen || pathname.startsWith("/collections") || pathname === "/trash";

  return (
    <nav
      className={`fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-30 flex items-center gap-2.5 transition-transform duration-300 lg:hidden ${
        hidden ? "translate-y-[calc(100%+40px)]" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center rounded-full px-1 py-[3px]" style={GLASS}>
        <Link href="/app" className={itemClass(pathname === "/app" && !menuOpen)} aria-current={pathname === "/app" ? "page" : undefined}>
          {/* A chain, not a grid — the grid glyph belongs to the layout tab beside it. */}
          <TabIcon d="M9.5 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14.5 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
          <span className={label}>Links</span>
        </Link>
        {/* Library only, phone widths: the tab names the layout a tap switches to. */}
        {pathname === "/app" && (
          <button type="button" onClick={toggleList} className={`${itemClass(false)} sm:hidden`} aria-pressed={list}>
            <Icon name={list ? "grid" : "list"} size={21} strokeWidth={2.4} />
            <span className={label}>{list ? "Grid" : "List"}</span>
          </button>
        )}
        {/* Collections live in the drawer — this tab is the way in. */}
        <button type="button" onClick={() => setMenuOpen(true)} className={itemClass(inCollections)}>
          <TabIcon d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <span className={label}>Collections</span>
        </button>
        <button type="button" onClick={openPalette} className={itemClass(paletteOpen)}>
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
