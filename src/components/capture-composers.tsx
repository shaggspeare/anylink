"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { useLibrary } from "@/lib/store";
import { linkify } from "@/lib/linkify";
import type { Collection } from "@/lib/types";

const FIELD_STYLE = { borderColor: "rgb(var(--ink-rgb) / 0.16)", background: "rgb(var(--ink-rgb) / 0.05)" };

type Shared = {
  collectionId: string;
  setCollectionId: (id: string) => void;
  onSaved: () => void;
};

/** Plain text, links clickable once saved — no formatting toolbar on purpose. */
export function NoteComposer({ initialText = "", collectionId, setCollectionId, onSaved }: Shared & { initialText?: string }) {
  const { addNote, collections, showToast } = useLibrary();
  const [text, setText] = useState(initialText);
  const [saving, setSaving] = useState(false);
  const found = useMemo(() => linkify(text).filter((p) => p.href), [text]);
  const canSave = Boolean(text.trim()) && Boolean(collectionId) && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await addNote(text, collectionId);
      onSaved();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't save the note.");
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        className="relative overflow-hidden rounded-[22px]"
        style={{ background: "rgb(var(--surface-rgb) / .62)", border: "1px solid rgb(var(--rim-rgb) / .75)" }}
      >
        {/* The lime fold is the note's mark everywhere it appears — card, row, composer. */}
        <span aria-hidden className="note-fold absolute right-0 top-0 h-7 w-7" />
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void save();
            }
          }}
          placeholder={"Write it down.\nLinks you paste stay clickable."}
          aria-label="Note text"
          className="block max-h-[46dvh] min-h-[180px] w-full resize-none bg-transparent px-5 pb-4 pt-5 text-[17px] leading-[1.5] tracking-[-.012em] text-ink outline-none [field-sizing:content] placeholder:text-ink/35"
        />
        {found.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-t px-4 py-2.5" style={{ borderColor: "rgb(var(--rim-rgb) / .6)" }}>
            <Icon name="link" size={12} className="text-signal" />
            {found.slice(0, 4).map((p, i) => (
              <span key={i} className="max-w-[220px] truncate rounded-full bg-signal/12 px-2.5 py-0.5 text-[11.5px] font-medium text-signal">
                {p.text.replace(/^https?:\/\/(www\.)?/i, "")}
              </span>
            ))}
            {found.length > 4 && <span className="text-[11.5px] text-ink/45">+{found.length - 4}</span>}
          </div>
        )}
      </div>
      <SaveRow
        collections={collections}
        collectionId={collectionId}
        setCollectionId={setCollectionId}
        onSave={save}
        canSave={canSave}
        label={saving ? "Saving…" : "Save note"}
        hint="⌘↵"
      />
    </div>
  );
}

/** One image per save. Drop, paste (⌘V while the sheet is open) or pick from disk. */
export function ImageComposer({ initialFile, collectionId, setCollectionId, onSaved }: Shared & { initialFile?: File }) {
  const { addImage, collections, showToast } = useLibrary();
  const [file, setFile] = useState<File | undefined>(initialFile);
  const [caption, setCaption] = useState("");
  const [saving, setSaving] = useState(false);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : undefined), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const take = (files: FileList | File[] | null | undefined) => {
    const image = Array.from(files ?? []).find((f) => f.type.startsWith("image/"));
    if (image) setFile(image);
  };

  // ⌘V inside the open sheet: the global listener stands down while it's open.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData?.files.length) return;
      e.preventDefault();
      take(e.clipboardData.files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const canSave = Boolean(file) && Boolean(collectionId) && !saving;
  const save = async () => {
    if (!canSave || !file) return;
    setSaving(true);
    try {
      await addImage(file, collectionId, caption);
      onSaved();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't save the image.");
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => take(e.target.files)}
      />
      {file && preview ? (
        <div className="image-frame relative overflow-hidden rounded-[22px]">
          {/* eslint-disable-next-line @next/next/no-img-element -- a local blob: URL */}
          <img src={preview} alt="" className="mx-auto block max-h-[42dvh] w-auto max-w-full object-contain" />
          <div className="absolute inset-x-3 bottom-3 flex items-center gap-2">
            <span className="min-w-0 truncate rounded-full bg-black/55 px-3 py-1 text-[11.5px] font-medium text-white backdrop-blur-md">
              {file.name || "Pasted image"} · {formatBytes(file.size)}
            </span>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="ml-auto flex-none rounded-full bg-black/55 px-3 py-1 text-[11.5px] font-semibold text-white backdrop-blur-md hover:bg-black/70"
            >
              Replace
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            take(e.dataTransfer.files);
          }}
          className={`flex flex-col items-start gap-3.5 rounded-[22px] border border-dashed px-6.5 py-7.5 text-left transition-colors ${
            over ? "bg-periwinkle/12" : ""
          }`}
          style={{ borderColor: over ? "var(--periwinkle)" : "rgb(var(--ink-rgb) / 0.18)" }}
        >
          <span className="flex h-[46px] w-[46px] items-center justify-center rounded-[14px] bg-periwinkle/20 text-periwinkle">
            <Icon name="image" size={22} />
          </span>
          <span className="text-[18px] font-semibold tracking-[-.035em] text-ink">Drop a screenshot</span>
          <span className="max-w-[420px] text-[13px] leading-[1.6] text-ink/55">
            Or paste one with <kbd className="font-sans font-semibold text-ink/75">⌘V</kbd>, or click to choose a file.
            It&apos;s kept as-is, sized down for the web.
          </span>
        </button>
      )}
      {file && (
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void save()}
          placeholder="Caption (optional)"
          aria-label="Caption"
          className="h-[42px] rounded-[12px] border px-3.5 text-[13.5px] text-ink outline-none placeholder:text-ink/40"
          style={FIELD_STYLE}
        />
      )}
      <SaveRow
        collections={collections}
        collectionId={collectionId}
        setCollectionId={setCollectionId}
        onSave={save}
        canSave={canSave}
        label={saving ? "Uploading…" : "Save image"}
      />
    </div>
  );
}

function SaveRow({
  collections,
  collectionId,
  setCollectionId,
  onSave,
  canSave,
  label,
  hint,
}: {
  collections: Collection[];
  collectionId: string;
  setCollectionId: (id: string) => void;
  onSave: () => void;
  canSave: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex min-w-0 flex-1 items-center gap-2">
        <Icon name="folder" size={14} className="flex-none text-ink/45" />
        <select
          value={collectionId}
          onChange={(e) => setCollectionId(e.target.value)}
          aria-label="Collection"
          className="h-[42px] min-w-0 flex-1 rounded-full border px-3.5 text-[13px] text-ink outline-none"
          style={FIELD_STYLE}
        >
          {collections
            .filter((c) => !c.isSmart)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </label>
      <button
        type="button"
        onClick={onSave}
        disabled={!canSave}
        className="flex h-[42px] flex-none items-center gap-2 rounded-full bg-signal px-5 text-[13px] font-semibold text-on-accent disabled:opacity-45 max-sm:basis-full max-sm:justify-center"
      >
        {label}
        {hint && <span className="hidden text-[11px] font-medium opacity-60 pointer-fine:inline">{hint}</span>}
      </button>
    </div>
  );
}

function formatBytes(n: number) {
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}
