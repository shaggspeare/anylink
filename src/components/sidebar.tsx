"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLibrary } from "@/lib/store";
import { CollectionMarker } from "./collection-marker";
import { ALL_COLLECTION_ID } from "@/lib/mock-data";

export function Sidebar() {
  const { collections, countForCollection } = useLibrary();
  const pathname = usePathname();

  const isAllActive = pathname === "/";

  return (
    <aside
      className="fixed inset-y-0 left-0 z-20 hidden w-[250px] flex-none flex-col border-r px-4 py-5 lg:flex"
      style={{
        background: "rgba(255,255,255,.55)",
        borderColor: "rgba(255,255,255,.8)",
        backdropFilter: "blur(24px) saturate(1.4)",
        WebkitBackdropFilter: "blur(24px) saturate(1.4)",
      }}
    >
      <div className="flex items-center gap-2 px-2 py-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-ink text-[13px] font-bold text-[#f4f5f6]">
          A
        </span>
        <span className="text-wordmark">AnyLink</span>
      </div>

      <nav className="mt-4 flex flex-col gap-0.5">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-body transition-colors"
          style={{ background: isAllActive ? "rgba(23,24,27,.06)" : "transparent" }}
        >
          <CollectionMarker color="#17181b" />
          <span className="flex-1 truncate">All links</span>
          <span className="text-meta text-ink/45">{countForCollection(ALL_COLLECTION_ID)}</span>
        </Link>
        {collections.map((c) => {
          const active = pathname === `/collections/${c.id}`;
          return (
            <Link
              key={c.id}
              href={`/collections/${c.id}`}
              className="flex items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-body transition-colors"
              style={{ background: active ? "rgba(23,24,27,.06)" : "transparent" }}
            >
              <CollectionMarker color={c.color} />
              <span className="flex-1 truncate">{c.name}</span>
              <span className="text-meta text-ink/45">{countForCollection(c.id)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-2 rounded-[14px] bg-ink/6 px-3 py-2.5 text-meta text-ink/50">
        <kbd className="rounded-[7px] bg-white px-1.5 py-0.5 text-[10px] font-semibold text-ink/70 shadow-sm">
          ⌘V
        </kbd>
        paste anywhere to add a link
      </div>
    </aside>
  );
}
