"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLibrary } from "@/lib/store";
import { AmbientOrbs } from "./ambient-orbs";

type Bookmark = { url: string; title: string };
type ResultRow = { url: string; title: string; ok: boolean; reason?: string };

const MAX_BOOKMARKS = 200;

function parseBookmarksFile(html: string): Bookmark[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const seen = new Set<string>();
  const bookmarks: Bookmark[] = [];
  doc.querySelectorAll("a[href]").forEach((a) => {
    const url = a.getAttribute("href") ?? "";
    if (!/^https?:\/\//i.test(url) || seen.has(url)) return;
    seen.add(url);
    bookmarks.push({ url, title: a.textContent?.trim() || url });
  });
  return bookmarks.slice(0, MAX_BOOKMARKS);
}

export function BookmarksImportButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-body text-ink/50 hover:bg-ink/6 hover:text-ink"
      >
        <span className="flex h-4 w-4 items-center justify-center text-[13px] leading-none">↓</span>
        Import bookmarks
      </button>
      {open && <BookmarksImportModal onClose={() => setOpen(false)} />}
    </>
  );
}

function BookmarksImportModal({ onClose }: { onClose: () => void }) {
  const { collections, importBookmark } = useLibrary();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [bookmarks, setBookmarks] = useState<Bookmark[] | null>(null);
  const [collectionId, setCollectionId] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ResultRow[]>([]);

  const handleFile = async (file: File) => {
    const text = await file.text();
    const found = parseBookmarksFile(text);
    setBookmarks(found);
  };

  const startImport = async () => {
    if (!bookmarks || !collectionId) return;
    setImporting(true);
    setProgress(0);
    setResults([]);
    for (const b of bookmarks) {
      const result = await importBookmark(b.url, b.title, collectionId);
      setResults((prev) => [
        { url: b.url, title: b.title, ok: result.ok, reason: result.ok ? undefined : result.reason },
        ...prev,
      ]);
      setProgress((p) => p + 1);
    }
    setImporting(false);
  };

  const succeeded = results.filter((r) => r.ok).length;
  const done = bookmarks && progress === bookmarks.length && progress > 0;

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      style={{ background: "rgba(13,14,16,.42)", backdropFilter: "blur(6px)" }}
      onClick={() => !importing && onClose()}
    >
      <div
        className="relative w-full max-w-[560px] overflow-hidden rounded-[30px]"
        style={{ boxShadow: "0 40px 90px rgba(0,0,0,.5)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative min-h-[320px] overflow-hidden" style={{ background: "#111214" }}>
          <AmbientOrbs variant="dark" />
          <div className="relative flex flex-col gap-5 p-6">
            <div className="flex items-center gap-3">
              <h3 className="text-title text-[#f4f5f6]">Import bookmarks</h3>
              {!importing && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-light-55 hover:bg-white/10"
                >
                  ✕
                </button>
              )}
            </div>

            {!bookmarks && (
              <div
                className="flex flex-col items-start gap-3.5 rounded-[22px] border border-dashed px-6.5 py-7.5"
                style={{ borderColor: "rgba(255,255,255,.18)" }}
              >
                <div className="text-[15px] font-semibold text-[#f4f5f6]">Export bookmarks as HTML</div>
                <p className="max-w-[400px] text-[13px] leading-[1.6] text-light-55">
                  Every browser can export bookmarks as an HTML file (Chrome, Firefox, Safari all use the
                  same format). Pick that file below — each link gets crawled and filed the same way a
                  pasted URL would be, up to {MAX_BOOKMARKS} at a time.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".html,.htm"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-full bg-signal px-5 py-2.5 text-[13px] font-semibold text-[#111214]"
                >
                  Choose file…
                </button>
              </div>
            )}

            {bookmarks && !importing && !done && (
              <div className="flex flex-col gap-4">
                <p className="text-[13px] text-light-55">
                  Found <span className="font-semibold text-[#f4f5f6]">{bookmarks.length}</span> links.
                </p>
                <label className="flex flex-col gap-1.5">
                  <span className="text-eyebrow text-light-40">Save into *</span>
                  <select
                    value={collectionId}
                    onChange={(e) => setCollectionId(e.target.value)}
                    className="h-[42px] rounded-[12px] border px-3.5 text-[13.5px] text-[#f4f5f6] outline-none"
                    style={{ borderColor: "rgba(255,255,255,.16)", background: "rgba(255,255,255,.06)" }}
                  >
                    <option value="" disabled>
                      Choose a collection
                    </option>
                    {collections
                      .filter((c) => !c.isSmart)
                      .map((c) => (
                        <option key={c.id} value={c.id} className="bg-[#111214]">
                          {c.name}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={startImport}
                  disabled={!collectionId}
                  className="h-[46px] rounded-full bg-signal text-[13.5px] font-semibold text-[#111214] disabled:opacity-50"
                >
                  Import {bookmarks.length} bookmarks
                </button>
              </div>
            )}

            {bookmarks && (importing || done) && (
              <div className="flex flex-col gap-3.5">
                <div className="flex items-center gap-3">
                  <div className="text-[14px] font-semibold text-[#f4f5f6]">
                    {done ? "Done" : "Importing…"}
                  </div>
                  <div className="ml-auto font-mono text-[13px] font-semibold text-lime tabular-nums">
                    {progress}/{bookmarks.length}
                  </div>
                </div>
                <div className="h-[5px] overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,.12)" }}>
                  <div
                    className="h-full rounded-full bg-lime transition-[width] duration-300"
                    style={{ width: `${(progress / bookmarks.length) * 100}%` }}
                  />
                </div>
                {done && (
                  <p className="text-[13px] text-light-55">
                    {succeeded} saved, {results.length - succeeded} failed.
                  </p>
                )}
                <div className="flex max-h-[220px] flex-col gap-1 overflow-y-auto">
                  {results.slice(0, 30).map((r, i) => (
                    <div key={i} className="flex items-center gap-2 truncate text-[12px]">
                      <span style={{ color: r.ok ? "#d6f24b" : "#ff8a5c" }}>{r.ok ? "✓" : "✕"}</span>
                      <span className="truncate text-light-55">{r.title}</span>
                    </div>
                  ))}
                </div>
                {done && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-[42px] rounded-full bg-white/10 text-[13px] font-semibold text-[#f4f5f6]"
                  >
                    Close
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
