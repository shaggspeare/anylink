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

  // Arrived from the OS share sheet (see app/manifest.ts). Many Android apps put the link
  // in `text` rather than `url`, so both are checked.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shared = [params.get("shared_url"), params.get("shared_text")]
      .map((v) => v?.match(/https?:\/\/\S+/)?.[0])
      .find(Boolean);
    if (!params.has("shared_url") && !params.has("shared_text")) return;
    ["shared_url", "shared_text", "shared_title"].forEach((k) => params.delete(k));
    const rest = params.toString();
    history.replaceState(history.state, "", window.location.pathname + (rest ? `?${rest}` : ""));
    if (shared) openAddLink(shared);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        return;
      }
      // Single-key shortcuts, only when nothing else wants the keystroke. N, not ⌘N:
      // browsers keep ⌘N for a new window.
      if (meta || e.altKey || isEditableTarget(e.target) || paletteOpen || addLinkOpen) return;
      if (document.querySelector("[aria-modal]")) return;
      if (e.key === "/") {
        e.preventDefault();
        openPalette();
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        openAddLink();
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
