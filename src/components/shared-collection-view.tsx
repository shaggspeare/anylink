"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLibrary } from "@/lib/store";
import { linkCount } from "@/lib/format";
import { AmbientOrbs } from "@/components/ambient-orbs";
import { CollectionMarker } from "@/components/collection-marker";
import { HeroArt } from "@/components/card";
import { Logo } from "@/components/logo";
import type { LinkItem, SharedCollection } from "@/lib/types";

/** `?save=all` means the whole collection, any other value a link id. */
const ALL = "all";

/** What a viewer sees at /s/<token>: read-only cards, each with Save, and Save all. Signed-out
 * viewers sign in first and come back to a `?save=` that finishes the job. */
export function SharedCollectionView({ token, shared, iOS }: { token: string; shared: SharedCollection; iOS: boolean }) {
  const { guest, demo, inbox, saveFromShare, showToast, openSignUp } = useLibrary();
  const signedIn = !guest && !demo;
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const save = async (key: string) => {
    if (!signedIn) {
      // The auth round trip comes back to this URL, query included.
      history.replaceState(null, "", `?save=${encodeURIComponent(key)}`);
      openSignUp();
      return;
    }
    setBusy(true);
    try {
      const { links, collection } = await saveFromShare(token, key === ALL ? undefined : [key]);
      setSaved((prev) => new Set(prev).add(key));
      showToast(
        collection
          ? `Saved “${collection.name}” — ${linkCount(links.length)}`
          : `Saved to ${inbox?.name ?? "Unsorted"}`
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  // Back from sign-in: finish the save they asked for, once.
  const resumed = useRef(false);
  useEffect(() => {
    const key = new URLSearchParams(location.search).get("save");
    if (!signedIn || !key || resumed.current) return;
    resumed.current = true;
    history.replaceState(null, "", location.pathname);
    save(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">
      <AmbientOrbs variant="library" />
      <div className="relative mx-auto flex max-w-[1100px] flex-col gap-5 px-4 pb-10 pt-[max(24px,env(safe-area-inset-top))] sm:px-6">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <CollectionMarker color={shared.color} icon={shared.icon} size={14} />
          <h1 className="text-title min-w-0 truncate text-[26px]">{shared.name}</h1>
          <span className="text-meta text-ink/50">
            {linkCount(shared.links.length)}
            {shared.ownerName && ` · shared by ${shared.ownerName}`}
          </span>
          {iOS && (
            <a
              href={`anylink://s/${token}`}
              className="flex h-10 items-center rounded-full border border-rim/90 bg-surface/70 px-5 text-body font-semibold text-ink sm:ml-auto"
            >
              Open in app
            </a>
          )}
          {shared.links.length > 0 && (
            <button
              type="button"
              disabled={busy || saved.has(ALL)}
              onClick={() => save(ALL)}
              className="ml-auto flex h-10 items-center rounded-full bg-ink px-5 text-body font-semibold text-on-ink disabled:opacity-50"
            >
              {saved.has(ALL) ? "Saved to your library" : "Save collection"}
            </button>
          )}
        </header>

        {shared.links.length === 0 ? (
          <p className="text-body text-ink/60">Nothing here yet.</p>
        ) : (
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shared.links.map((link) => (
              <SharedCard
                key={link.id}
                link={link}
                saved={saved.has(link.id) || saved.has(ALL)}
                disabled={busy}
                onSave={() => save(link.id)}
              />
            ))}
          </div>
        )}

        <Link href="/" className="flex items-center gap-2 self-center pt-4 text-meta text-ink/55 hover:text-ink">
          <Logo className="h-5 w-5" />
          Made with AnyLink
        </Link>
      </div>
    </div>
  );
}

function SharedCard({
  link,
  saved,
  disabled,
  onSave,
}: {
  link: LinkItem;
  saved: boolean;
  disabled: boolean;
  onSave: () => void;
}) {
  const isNote = link.contentType === "note";
  const price = link.product?.price;
  // A note has no page to open; an image opens the stored file.
  const href = isNote ? undefined : link.url;
  const open = href ? { href, target: "_blank", rel: "noopener noreferrer" } : {};

  return (
    <article className="glass-55 flex flex-col overflow-hidden rounded-[22px]">
      {!isNote && (
        <a {...open} className="relative block aspect-[16/10]">
          <HeroArt link={link} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
        </a>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        {link.domain && <span className="text-meta text-ink/50">{link.domain}</span>}
        {/* A note's title is just its first line, so the text alone says it. */}
        {!isNote && (
          <a {...open} className="text-[17px] font-semibold leading-snug text-ink hover:underline">
            {link.title}
          </a>
        )}
        {link.excerpt && (
          <p className={`text-body text-ink/70 ${isNote ? "whitespace-pre-wrap" : "line-clamp-3"}`}>{link.excerpt}</p>
        )}
        {price !== undefined && (
          <p className="text-[17px] font-semibold text-ink">
            {link.product!.currency}
            {price.toLocaleString()}
            {link.product!.inStock === false && <span className="ml-2 text-meta font-normal text-ink/50">Out of stock</span>}
          </p>
        )}
        {link.note && <p className="rounded-[12px] bg-ink/5 px-3 py-2 text-body text-ink/80">{link.note}</p>}
        <button
          type="button"
          disabled={disabled || saved}
          onClick={onSave}
          className="mt-auto self-start rounded-full border border-rim/90 bg-surface/70 px-4 py-1.5 text-meta font-semibold text-ink disabled:opacity-50"
        >
          {saved ? "Saved" : "Save"}
        </button>
      </div>
    </article>
  );
}
