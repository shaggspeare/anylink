"use client";

import { useEffect } from "react";
import { useLibrary } from "@/lib/store";

const URL_PATTERN = /^https?:\/\/\S+$/i;

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable
  );
}

export function GlobalCaptureListener() {
  const { openAddLink, openPalette, closePalette, paletteOpen, addLinkOpen, closeAddLink } =
    useLibrary();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (paletteOpen) closePalette();
        else openPalette();
        return;
      }
      if (e.key === "Escape") {
        if (paletteOpen) closePalette();
        else if (addLinkOpen) closeAddLink();
      }
    };

    const onPaste = (e: ClipboardEvent) => {
      if (isEditableTarget(e.target) || addLinkOpen || paletteOpen) return;
      const text = e.clipboardData?.getData("text")?.trim();
      if (text && URL_PATTERN.test(text)) {
        e.preventDefault();
        openAddLink(text);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("paste", onPaste);
    };
  }, [openAddLink, openPalette, closePalette, paletteOpen, addLinkOpen, closeAddLink]);

  return null;
}
