"use client";

import { Icon } from "@/components/icon";
import { useState } from "react";
import type { Collection } from "@/lib/types";

export function BulkActionBar({
  count,
  collections,
  tags,
  onMove,
  onTag,
  onArchive,
  onDelete,
  onClear,
}: {
  count: number;
  collections: Collection[];
  /** Every tag already in the library, offered as completions on the tag field. */
  tags: string[];
  onMove: (collectionId: string) => void;
  onTag: (tag: string) => void;
  onArchive: () => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  const [tagOpen, setTagOpen] = useState(false);
  const [tagValue, setTagValue] = useState("");

  if (count === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-6 z-30 flex justify-center px-4">
      <div
        className="flex items-center gap-2 rounded-full px-3 py-2 text-[#f4f5f6]"
        style={{ background: "#17181b", boxShadow: "var(--shadow-window)" }}
      >
        <span className="flex h-8 items-center rounded-full bg-white/10 px-3 text-[12.5px] font-semibold">
          {count} selected
        </span>

        <select
          onChange={(e) => {
            if (e.target.value) onMove(e.target.value);
            e.target.value = "";
          }}
          defaultValue=""
          className="h-8 rounded-full bg-white/10 px-3 text-[12.5px] font-medium outline-none"
        >
          <option value="" disabled>
            Move to…
          </option>
          {/* Custom filters aren't places links can live in, so they're not move targets. */}
          {collections
            .filter((c) => !c.isSmart)
            .map((c) => (
              <option key={c.id} value={c.id} className="bg-[#17181b]">
                {c.name}
              </option>
            ))}
        </select>

        {tagOpen ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (tagValue.trim()) onTag(tagValue.trim());
              setTagValue("");
              setTagOpen(false);
            }}
            className="flex items-center"
          >
            <input
              autoFocus
              list="library-tags"
              value={tagValue}
              onChange={(e) => setTagValue(e.target.value)}
              onBlur={() => setTagOpen(false)}
              placeholder="tag name"
              className="h-8 w-28 rounded-full bg-white/10 px-3 text-[12.5px] outline-none placeholder:text-white/40"
            />
            <datalist id="library-tags">
              {tags.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setTagOpen(true)}
            className="h-8 rounded-full bg-white/10 px-3 text-[12.5px] font-medium hover:bg-white/15"
          >
            Tag
          </button>
        )}

        <button
          type="button"
          onClick={onArchive}
          className="h-8 rounded-full bg-white/10 px-3 text-[12.5px] font-medium hover:bg-white/15"
        >
          Archive
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Delete ${count} link${count > 1 ? "s" : ""}?`)) onDelete();
          }}
          className="h-8 rounded-full px-3 text-[12.5px] font-medium hover:bg-white/10"
          style={{ color: "#ff8a5c" }}
        >
          Delete
        </button>

        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          className="ml-1 flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10"
        >
          <Icon name="close" size={13} />
        </button>
      </div>
    </div>
  );
}
