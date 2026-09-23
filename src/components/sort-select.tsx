"use client";

import { SORT_LABELS, type Sort } from "@/lib/organize";

const ORDER: Sort[] = ["newest", "oldest", "title", "site", "manual"];

const CHEVRON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#8a8f96" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 9 7 7 7-7"/></svg>`;

export function SortSelect({ value, onChange }: { value: Sort; onChange: (sort: Sort) => void }) {
  return (
    <select
      data-tour="sort"
      value={value}
      onChange={(e) => onChange(e.target.value as Sort)}
      aria-label="Sort"
      // The native arrow is pinned to the very edge of the pill, so it's replaced by our
      // own chevron, inset like the label on the other side.
      className="h-8 appearance-none rounded-full bg-ink/6 pl-3.5 pr-8 text-[12px] font-medium text-ink/65 outline-none"
      style={{
        backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(CHEVRON)}")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 12px center",
        backgroundSize: "10px",
      }}
    >
      {ORDER.map((s) => (
        <option key={s} value={s}>
          {SORT_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
