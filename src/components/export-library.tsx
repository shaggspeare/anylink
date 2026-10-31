"use client";

import { useState } from "react";
import { useLibrary } from "@/lib/store";
import { isPro } from "@/lib/plan";

const FORMATS = [
  ["html", "Bookmarks (HTML)"],
  ["json", "Everything (JSON)"],
  ["csv", "Spreadsheet (CSV)"],
] as const;

/** Settings → Your library: the library as a file, from `GET /api/v1/export`. Pro only: a free account sees the
 * buttons disabled with the reason, and a refusal (the plan changed since the page loaded) is a toast. */
export function ExportLibrary() {
  const { plan, showToast } = useLibrary();
  const [busy, setBusy] = useState<string | null>(null);
  const pro = isPro(plan);

  const download = async (format: string) => {
    setBusy(format);
    try {
      const res = await fetch(`/api/v1/export?format=${format}`);
      if (!res.ok) {
        const refusal = await res.json().catch(() => null);
        showToast(refusal?.reason === "pro" ? "Export is a Pro feature." : "Couldn't export your library.");
        return;
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(await res.blob());
      a.download = res.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? `anylink.${format}`;
      a.click();
      // Long enough for the browser to start saving it.
      setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
    } catch {
      showToast("Couldn't export your library.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-body text-ink">Export your library</span>
      <div className="flex flex-wrap gap-2">
        {FORMATS.map(([format, label]) => (
          <button
            key={format}
            type="button"
            disabled={!pro || busy !== null}
            onClick={() => download(format)}
            className="h-10 rounded-full border border-rim/90 bg-surface/70 px-3.5 text-body text-ink disabled:opacity-50"
          >
            {busy === format ? "Exporting…" : label}
          </button>
        ))}
      </div>
      {!pro && <p className="text-meta text-ink/60">Export is a Pro feature.</p>}
    </div>
  );
}
