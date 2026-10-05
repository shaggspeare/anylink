"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { useLibrary } from "@/lib/store";
import type { LinkItem } from "@/lib/types";
import { NoteText } from "./note-text";

function savedOn(link: LinkItem) {
  return new Date(link.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** Reads like a page, edits in place: click the text (not a link in it) or Edit. */
export function NotePanel({ link }: { link: LinkItem }) {
  const { setNoteText } = useLibrary();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(link.excerpt);

  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== link.excerpt) setNoteText(link.id, draft);
    else setDraft(link.excerpt);
  };

  return (
    <div className="mx-auto w-full max-w-[720px] px-4 py-6 sm:px-8 sm:py-10">
      <div className="mb-4 flex items-center gap-2 text-[12px] text-ink/50">
        <span className="flex h-6 items-center gap-1.5 rounded-full bg-lime px-2.5 font-semibold text-on-accent">
          <Icon name="note" size={12} />
          Note
        </span>
        <span>{savedOn(link)}</span>
        <button
          type="button"
          onClick={() => (editing ? commit() : setEditing(true))}
          className="ml-auto flex h-8 items-center gap-1.5 rounded-full border border-rim/90 bg-surface/70 px-3.5 font-semibold text-ink hover:border-ink"
        >
          {editing ? <Icon name="check" size={12} /> : <Icon name="pencil" size={12} />}
          {editing ? "Done" : "Edit"}
        </button>
      </div>
      <div
        className="relative overflow-hidden rounded-[26px] px-6 py-6 sm:px-9 sm:py-8"
        style={{
          background: "rgb(var(--surface-rgb) / .7)",
          border: "1px solid rgb(var(--rim-rgb) / .8)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <span aria-hidden className="note-fold absolute right-0 top-0 h-10 w-10" />
        {editing ? (
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                commit();
              }
            }}
            aria-label="Note text"
            className="block min-h-[240px] w-full resize-none bg-transparent text-[18px] leading-[1.6] tracking-[-.012em] text-ink outline-none [field-sizing:content]"
          />
        ) : (
          <div
            onClick={() => {
              // Selecting text to copy shouldn't flip into edit mode.
              if (!window.getSelection()?.toString()) setEditing(true);
            }}
            className="cursor-text text-[18px] leading-[1.6] tracking-[-.012em] text-ink"
          >
            <NoteText text={link.excerpt} />
          </div>
        )}
      </div>
    </div>
  );
}

/** The image at its own aspect on a dark mat, with the caption under it. */
export function ImagePanel({ link }: { link: LinkItem }) {
  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4 px-4 py-6 sm:px-8 sm:py-8">
      <a
        href={link.url}
        target="_blank"
        rel="noreferrer noopener"
        title="Open full size"
        className="image-frame group relative block overflow-hidden rounded-[26px]"
      >
        {link.heroImage && (
          // Plain img: the stored file is already sized for the web, and next/image would
          // need dimensions we don't keep.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={link.heroImage} alt={link.title} className="mx-auto block max-h-[78dvh] w-auto max-w-full object-contain" />
        )}
        <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-[11.5px] font-semibold text-white opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100">
          Full size <Icon name="arrow-up-right" size={11} />
        </span>
      </a>
      <div className="flex items-center gap-2 px-1">
        <Icon name="image" size={15} className="flex-none text-periwinkle" />
        <h1 className="min-w-0 flex-1 truncate text-[20px] font-semibold tracking-[-.035em] text-ink">{link.title}</h1>
        <span className="flex-none text-[12px] text-ink/45">{savedOn(link)}</span>
      </div>
    </div>
  );
}
