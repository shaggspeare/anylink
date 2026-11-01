"use client";

import { APP_STORE_URL, PRO_BENEFITS } from "@/lib/pro";

/** Web can't sell Pro (docs/adr/0002), so this says where to get it. Every Pro refusal and every Pro control opens
 * it, through `openPro` in the library store. */
export function ProDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-dialog-title"
      className="fixed inset-0 z-[80] grid items-end sm:place-items-center sm:p-4"
      style={{ background: "rgba(13,14,16,.42)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        className="glass-70 relative flex w-full flex-col gap-4 rounded-t-[28px] p-7 pb-[max(28px,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          autoFocus
          className="absolute right-5 top-5 text-ink/50 hover:text-ink"
        >
          ✕
        </button>
        <h2 id="pro-dialog-title" className="text-title text-[22px]">
          AnyLink Pro
        </h2>
        <p className="text-body text-ink">Pro is sold in the AnyLink iOS app.</p>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-body text-ink/75">
          {PRO_BENEFITS.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        {APP_STORE_URL ? (
          <a
            href={APP_STORE_URL}
            className="flex h-11 items-center justify-center rounded-full bg-ink px-5 text-body font-semibold text-on-ink"
          >
            Get AnyLink on the App Store
          </a>
        ) : (
          <p className="text-meta text-ink/60">AnyLink for iPhone is coming to the App Store.</p>
        )}
      </div>
    </div>
  );
}
