"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLibrary } from "@/lib/store";

function TabIcon({ d }: { d: string }) {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export function BottomTabBar() {
  const pathname = usePathname();
  const { openAddLink, openPalette } = useLibrary();
  const isLibrary = pathname === "/app";

  const itemClass = (active: boolean) =>
    `flex h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-full px-3 ${
      active ? "text-ink" : "text-ink/45"
    }`;

  return (
    <nav
      className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-around rounded-full px-2 py-1.5 lg:hidden"
      style={{
        background: "rgba(255,255,255,.55)",
        border: "1px solid rgba(255,255,255,.8)",
        backdropFilter: "blur(24px) saturate(1.4)",
        WebkitBackdropFilter: "blur(24px) saturate(1.4)",
        boxShadow: "var(--shadow-popover)",
      }}
    >
      <Link href="/app" className={itemClass(isLibrary)} aria-label="Library">
        <TabIcon d="M4 6h16M4 12h16M4 18h16" />
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
