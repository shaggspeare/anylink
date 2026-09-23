"use client";

import { useEffect } from "react";
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

export function BottomTabBar() {
  const pathname = usePathname();
  const { openAddLink, openPalette, setMenuOpen, menuOpen, addLinkOpen, paletteOpen } = useLibrary();
  const isLibrary = pathname === "/app";

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

  const itemClass = (active: boolean) =>
    `flex h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-full px-3 ${
      active ? "text-ink" : "text-ink/45"
    }`;

  return (
    <nav
      className="fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-30 flex items-center justify-around rounded-full px-2 py-1.5 lg:hidden"
      style={{
        background: "rgb(var(--surface-rgb) / .55)",
        border: "1px solid rgb(var(--rim-rgb) / .8)",
        backdropFilter: "blur(24px) saturate(1.4)",
        WebkitBackdropFilter: "blur(24px) saturate(1.4)",
        boxShadow: "var(--shadow-popover)",
      }}
    >
      <button type="button" onClick={() => setMenuOpen(true)} className={itemClass(false)} aria-label="Menu">
        <TabIcon d="M4 6h16M4 12h16M4 18h16" />
      </button>
      <Link href="/app" className={itemClass(isLibrary)} aria-label="All links">
        <TabIcon d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
      </Link>
      <button type="button" onClick={openPalette} className={itemClass(false)} aria-label="Search">
        <TabIcon d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16ZM21 21l-4.3-4.3" />
      </button>
      <button
        type="button"
        onClick={() => openAddLink()}
        className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-signal text-doc-shell"
        aria-label="Add a link"
      >
        <TabIcon d="M12 5v14M5 12h14" />
      </button>
    </nav>
  );
}

/** The tag-chip row scrolls sideways on its own — a swipe there is a scroll, not a gesture. */
function inHorizontalScroller(target: EventTarget | null) {
  for (let el = target as HTMLElement | null; el; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth && /auto|scroll/.test(getComputedStyle(el).overflowX)) return true;
  }
  return false;
}
