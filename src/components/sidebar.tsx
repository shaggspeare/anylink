"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLibrary } from "@/lib/store";
import { CollectionMarker } from "./collection-marker";
import { BookmarksImportButton } from "./bookmarks-import";
import { ALL_COLLECTION_ID } from "@/lib/mock-data";
import type { Collection } from "@/lib/types";

const SWATCHES = ["#ff5a1f", "#d6f24b", "#7c8cff", "#9aa3ad", "#e0855a"];

export function Sidebar() {
  const { collections, countForCollection, addCollection } = useLibrary();
  const pathname = usePathname();
  const [creating, setCreating] = useState(false);

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
        {collections.map((c) => (
          <CollectionRow key={c.id} collection={c} count={countForCollection(c.id)} active={pathname === `/collections/${c.id}`} />
        ))}
      </nav>

      <div className="mt-1">
        {creating ? (
          <NewCollectionForm
            onCreate={async (name, color) => {
              await addCollection(name, color);
              setCreating(false);
            }}
            onCancel={() => setCreating(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex w-full items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-body text-ink/50 hover:bg-ink/6 hover:text-ink"
          >
            <span className="flex h-4 w-4 items-center justify-center text-[14px] leading-none">+</span>
            New collection
          </button>
        )}
        <BookmarksImportButton />
      </div>

      <div className="mt-auto flex items-center gap-2 rounded-[14px] bg-ink/6 px-3 py-2.5 text-meta text-ink/50">
        <kbd className="rounded-[7px] bg-white px-1.5 py-0.5 text-[10px] font-semibold text-ink/70 shadow-sm">
          ⌘V
        </kbd>
        paste anywhere to add a link
      </div>
    </aside>
  );
}

function NewCollectionForm({
  onCreate,
  onCancel,
}: {
  onCreate: (name: string, color: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    await onCreate(name.trim(), color);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-2 rounded-[14px] bg-ink/6 p-2.5"
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
        placeholder="Collection name"
        className="h-8 rounded-[10px] border border-ink/10 bg-white px-2.5 text-[12.5px] text-ink outline-none"
      />
      <div className="flex items-center gap-1.5 px-0.5">
        {SWATCHES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setColor(s)}
            aria-label={s}
            className="h-5 w-5 rounded-full"
            style={{
              background: s,
              boxShadow: s === color ? "0 0 0 2px #17181b, 0 0 0 3px rgba(255,255,255,.9)" : undefined,
            }}
          />
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={onCancel} className="rounded-full px-2.5 py-1 text-[11.5px] text-ink/50 hover:text-ink">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || saving}
            className="rounded-full bg-ink px-3 py-1 text-[11.5px] font-semibold text-[#f4f5f6] disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>
    </form>
  );
}

function CollectionRow({
  collection,
  count,
  active,
}: {
  collection: Collection;
  count: number;
  active: boolean;
}) {
  const { renameCollection, deleteCollection } = useLibrary();
  const router = useRouter();
  const pathname = usePathname();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(collection.name);
  const [error, setError] = useState<string | null>(null);

  const submitRename = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== collection.name) renameCollection(collection.id, trimmed);
    setRenaming(false);
  };

  const handleDelete = async () => {
    setError(null);
    try {
      await deleteCollection(collection.id);
      if (pathname === `/collections/${collection.id}`) router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete this collection.");
    }
  };

  if (renaming) {
    return (
      <div className="flex items-center gap-2.5 rounded-[14px] px-3 py-2">
        <CollectionMarker color={collection.color} />
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={submitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitRename();
            if (e.key === "Escape") {
              setName(collection.name);
              setRenaming(false);
            }
          }}
          className="h-6 min-w-0 flex-1 rounded-[8px] border border-ink/15 bg-white px-1.5 text-[12.5px] text-ink outline-none"
        />
      </div>
    );
  }

  return (
    <div className="group relative flex items-center rounded-[14px]" style={{ background: active ? "rgba(23,24,27,.06)" : "transparent" }}>
      <Link href={`/collections/${collection.id}`} className="flex flex-1 items-center gap-2.5 px-3 py-2.5 text-body">
        <CollectionMarker color={collection.color} />
        <span className="flex-1 truncate">{collection.name}</span>
        <span className="text-meta text-ink/45 group-hover:hidden">{count}</span>
      </Link>
      <div className="absolute right-1.5 hidden items-center gap-0.5 group-hover:flex">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setRenaming(true);
          }}
          aria-label="Rename"
          className="flex h-6 w-6 items-center justify-center rounded-full text-ink/45 hover:bg-white hover:text-ink"
        >
          ✎
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            handleDelete();
          }}
          aria-label="Delete"
          disabled={!collection.isSmart && count > 0}
          title={!collection.isSmart && count > 0 ? "Move or delete its links first" : "Delete"}
          className="flex h-6 w-6 items-center justify-center rounded-full text-ink/45 hover:bg-white hover:text-ink disabled:opacity-30"
        >
          ✕
        </button>
      </div>
      {error && (
        <div className="absolute left-0 top-full z-10 mt-1 w-full rounded-[10px] bg-ink px-2.5 py-1.5 text-[11px] text-[#f4f5f6]">
          {error}
        </div>
      )}
    </div>
  );
}
