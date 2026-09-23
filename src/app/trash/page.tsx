"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLibrary } from "@/lib/store";
import { Sidebar } from "@/components/sidebar";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { AmbientOrbs } from "@/components/ambient-orbs";

export default function TrashPage() {
  const { trashed, restoreLinks, purgeLinks } = useLibrary();
  const router = useRouter();
  const [confirmingEmpty, setConfirmingEmpty] = useState(false);

  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">
      <AmbientOrbs variant="library" />
      <Sidebar />
      <div className="relative lg:pl-[250px]">
        <header className="flex items-end gap-3.5 px-4 pb-4 pt-6 sm:px-5 lg:px-6.5">
          <h1 className="text-hero text-[30px]">Trash</h1>
          <span className="pb-1.5 text-meta text-ink/50">{trashed.length} links</span>
          {trashed.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (!confirmingEmpty) return setConfirmingEmpty(true);
                purgeLinks(trashed.map((l) => l.id));
                setConfirmingEmpty(false);
                router.push("/app");
              }}
              onBlur={() => setConfirmingEmpty(false)}
              className="mb-1 ml-auto flex h-9 items-center rounded-full border border-rim/90 bg-surface/70 px-4 text-[12.5px] font-semibold text-ink"
            >
              {confirmingEmpty ? "Delete them for good?" : "Empty trash"}
            </button>
          )}
        </header>

        <div className="flex flex-col gap-1.5 px-4 pb-10 sm:px-5 lg:px-6.5">
          {trashed.length === 0 && (
            <p className="py-16 text-center text-body text-ink/45">
              Nothing here. Deleted links land in Trash until you empty it.
            </p>
          )}
          {trashed.map((link) => (
            <div
              key={link.id}
              data-tour="trash-item"
              className="flex items-center gap-3 rounded-[16px] border border-rim/75 bg-surface/62 px-4 py-3"
            >
              <span
                className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[7px] text-[10px] font-bold"
                style={{ color: link.stripe, background: link.tint }}
              >
                {link.initial}
              </span>
              <span className="min-w-0 flex-1 truncate text-body text-ink">{link.title}</span>
              <span className="hidden flex-none text-meta text-ink/45 sm:inline">{link.domain}</span>
              <button
                type="button"
                onClick={() => restoreLinks([link.id])}
                className="flex-none rounded-full bg-ink/6 px-3 py-1.5 text-[12px] font-semibold text-ink/70 hover:bg-ink/10"
              >
                Restore
              </button>
              <button
                type="button"
                onClick={() => purgeLinks([link.id])}
                aria-label="Delete forever"
                title="Delete forever"
                className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-ink/40 hover:bg-surface hover:text-ink"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="h-[calc(6rem+env(safe-area-inset-bottom))] lg:hidden" />
      </div>
      <BottomTabBar />
    </div>
  );
}
