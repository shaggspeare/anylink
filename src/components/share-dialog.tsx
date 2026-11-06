"use client";

import { useState } from "react";
import { useLibrary } from "@/lib/store";
import { isPro } from "@/lib/plan";
import type { Collection } from "@/lib/types";
import { useT } from "@/i18n/client";

/** The owner's side of a shared collection (docs/adr/0001): on/off, the link, and the name
 * shown on it. Off kills the link for good; on again makes a new one. Turning it on is Pro. */
export function ShareDialog({ collection, onClose }: { collection: Collection; onClose: () => void }) {
  const { setCollectionShared, displayName, setDisplayName, showToast, plan, openPro } = useLibrary();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(displayName ?? "");
  const url = collection.shareToken ? `${location.origin}/s/${collection.shareToken}` : null;
  const pro = isPro(plan);
  const t = useT();

  const toggle = async () => {
    if (!url && !pro) return openPro();
    setBusy(true);
    try {
      await setCollectionShared(collection.id, !url);
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("Couldn't change sharing. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const saveName = () => {
    if (name.trim() !== (displayName ?? "")) setDisplayName(name).catch(() => showToast(t("Couldn't save your name.")));
  };

  // Escape and the backdrop close without blurring the name field, so save it here too.
  const close = () => {
    saveName();
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("Share {name}", { name: collection.name })}
      className="fixed inset-0 z-[70] grid items-end sm:place-items-center sm:p-4"
      style={{ background: "rgba(13,14,16,.42)", backdropFilter: "blur(6px)" }}
      onClick={close}
      onKeyDown={(e) => e.key === "Escape" && close()}
    >
      <div
        className="glass-70 relative flex w-full flex-col gap-4 rounded-t-[28px] p-7 pb-[max(28px,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={close} aria-label={t("Close")} className="absolute right-5 top-5 text-ink/50 hover:text-ink">
          ✕
        </button>
        <h2 className="text-title text-[22px]">{t("Share “{name}”", { name: collection.name })}</h2>

        <label className="flex items-center justify-between gap-4">
          <span className="text-body text-ink">{t("Anyone with the link can view")}</span>
          <input
            type="checkbox"
            role="switch"
            checked={Boolean(url)}
            disabled={busy}
            onChange={toggle}
            className="h-5 w-5 accent-[var(--color-signal)]"
          />
        </label>

        {url ? (
          <>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={url}
                aria-label={t("Share link")}
                onFocus={(e) => e.target.select()}
                className="h-11 min-w-0 flex-1 rounded-full border border-rim/90 bg-surface/70 px-4 text-meta text-ink"
              />
              <button
                type="button"
                onClick={async () => {
                  if (navigator.share) await navigator.share({ title: collection.name, url }).catch(() => {});
                  else {
                    await navigator.clipboard.writeText(url);
                    showToast(t("Link copied"));
                  }
                }}
                className="h-11 flex-none rounded-full bg-ink px-5 text-body font-semibold text-on-ink"
              >
                {typeof navigator !== "undefined" && "share" in navigator ? t("Share…") : t("Copy")}
              </button>
            </div>
            <p className="text-meta text-ink/60">
              {pro
                ? t("Viewers see each link, its price, and your notes on it — not your tags or highlights. They can save copies to their own AnyLink. Turning sharing off breaks this link for good.")
                : t("Paused while you're on Free: viewers get “not found”. Go Pro and this same link works again. Turning sharing off breaks it for good.")}
            </p>
            <label className="flex flex-col gap-1.5">
              <span className="text-meta text-ink/60">{t("Your name on it (optional)")}</span>
              <input
                value={name}
                maxLength={40}
                placeholder={t("e.g. Sam")}
                onChange={(e) => setName(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                className="h-11 rounded-full border border-rim/90 bg-surface/70 px-4 text-body text-ink"
              />
            </label>
          </>
        ) : pro ? (
          <p className="text-meta text-ink/60">{t("Turn it on to get a link — handy for wishlists and reading lists.")}</p>
        ) : (
          <button type="button" onClick={openPro} className="self-start text-meta text-ink/60 underline underline-offset-2">
            {t("Share links are a Pro feature.")}
          </button>
        )}
      </div>
    </div>
  );
}
