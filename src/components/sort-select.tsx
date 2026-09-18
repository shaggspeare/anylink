"use client";

import { SORT_LABELS, type Sort } from "@/lib/organize";

const ORDER: Sort[] = ["newest", "oldest", "title", "site", "manual"];

export function SortSelect({ value, onChange }: { value: Sort; onChange: (sort: Sort) => void }) {
  return (
    <select
      data-tour="sort"
      value={value}
      onChange={(e) => onChange(e.target.value as Sort)}
      aria-label="Sort"
      className="h-8 rounded-full bg-ink/6 px-3 text-[12px] font-medium text-ink/65 outline-none"
    >
      {ORDER.map((s) => (
        <option key={s} value={s}>
          {SORT_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
