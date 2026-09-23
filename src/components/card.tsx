"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useLibrary } from "@/lib/store";
import { swallowClick, type useDragReorder } from "@/lib/use-drag-reorder";
import { CARD_GEOMETRY, CARD_TITLE_SIZE, GRID_ROW_UNIT, TILE_PX, sizeFromDrag } from "@/lib/geometry";
import type { CardSize, LinkItem } from "@/lib/types";

const SIZES: CardSize[] = ["S", "M", "L"];
const ENTRANCE_SCALES = [0.72, 1.14, 0.86, 1.22, 0.64, 1.06];
const MENU_ITEM =
  "flex h-8 items-center gap-2 rounded-[10px] px-2.5 text-[12.5px] font-medium text-[#f4f5f6] active:bg-white/15";

export function Card({
  index = 0,
  link,
  columnCount,
  tile = false,
  selectable = false,
  selectionActive = false,
  selected = false,
  onSelectClick,
  dragging = false,
  dragProps,
}: {
  /** Position in the mosaic — staggers the entrance animation. */
  index?: number;
  link: LinkItem;
  columnCount: number;
  /** Phone layout: a small uniform tile. Touch has no hover, so its actions sit behind ⋯. */
  tile?: boolean;
  selectable?: boolean;
  selectionActive?: boolean;
  selected?: boolean;
  onSelectClick?: (e: React.MouseEvent) => void;
  dragging?: boolean;
  /** From useDragReorder's `item(id)` — the FLIP ref plus, when reorderable, the drag handlers. */
  dragProps?: ReturnType<ReturnType<typeof useDragReorder>["item"]>;
}) {
  const router = useRouter();
  const { setLinkSize, setFavorite, deleteLinks } = useLibrary();
  const cardRef = useRef<HTMLDivElement>(null);
  const [resizing, setResizing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const geo = CARD_GEOMETRY[link.size];
  const cols = tile ? 1 : Math.min(geo.cols, columnCount);
  const rows = Math.round((tile ? TILE_PX : geo.rowPx) / GRID_ROW_UNIT);
  const hero = tile || link.size !== "S";
  const compact = !tile && link.size === "S";

  const handleOpen = (e: React.MouseEvent) => {
    if (selectable && selectionActive) {
      onSelectClick?.(e);
      return;
    }
    router.push(`/links/${link.id}`);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = cardRef.current;
    if (!el) return;
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    // Native HTML5 drag steals the pointer stream from a draggable ancestor, so it's
    // switched off for the duration of the resize.
    setResizing(true);
    let moved = false;

    // Measured once, never mid-drag: after a snap the mosaic FLIP-animates the card to its
    // new slot, and a rect read during that animation fed back into the size rule made
    // it flip-flop between sizes. The size is purely a function of cursor travel instead.
    const rect = el.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const unit = rect.width / cols;
    const inset = (el.offsetParent as HTMLElement).offsetWidth - rect.width; // both sides
    const column = (rect.width + inset) / cols;
    let lastSize = link.size;
    el.style.transformOrigin = "top left";
    el.style.transition = "none";
    el.style.willChange = "transform";

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      const w = rect.width + dx;
      const h = rect.height + dy;
      const next = sizeFromDrag(w, h, unit);
      if (next !== lastSize) {
        lastSize = next;
        setLinkSize(link.id, next);
      }
      // Rubber band: the card stretches a little toward the cursor, relative to the box
      // it has snapped to.
      const g = CARD_GEOMETRY[next];
      const boxW = Math.min(g.cols, columnCount) * column - inset;
      const boxH = g.rowPx - inset;
      const band = (d: number, size: number) => 1 + Math.max(-0.05, Math.min(0.05, d / size / 3));
      el.style.transform = `scale(${band(w - boxW, boxW)}, ${band(h - boxH, boxH)})`;
    };
    const up = () => {
      if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      el.style.transition = "transform .4s cubic-bezier(.2,1.5,.4,1)";
      el.style.transform = "";
      el.style.willChange = "";
      setResizing(false);
      // Without this the drag's trailing click opens a link, and the resize reads as
      // "nothing happened".
      if (moved) swallowClick();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Close on a tap anywhere else — and don't let that tap open whatever it landed on.
  useEffect(() => {
    if (!menuOpen) return;
    const outside = (e: PointerEvent) => {
      if (cardRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
      swallowClick();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("pointerdown", outside, true);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("keydown", esc);
    };
  }, [menuOpen]);

  return (
    <div
      {...dragProps}
      style={{
        position: "relative",
        gridColumn: `span ${cols}`,
        gridRow: `span ${rows}`,
        opacity: dragging ? 0.35 : 1,
        transition: "opacity .15s",
        // iOS-style entrance: tiles settle in from mixed sizes, staggered, capped so a
        // big library doesn't keep the last cards waiting.
        ["--card-from" as string]: ENTRANCE_SCALES[index % ENTRANCE_SCALES.length],
        animationDelay: `${Math.min(index * 35, 600)}ms`,
      }}
      className="card-enter"
      draggable={Boolean(dragProps && "draggable" in dragProps) && !resizing}
    >
      <div
        ref={cardRef}
        data-tour="card"
        onClick={handleOpen}
        role="button"
        tabIndex={0}
        className={`group absolute flex cursor-pointer flex-col overflow-hidden transition-[box-shadow,transform] ${
          tile ? "inset-1 select-none rounded-[16px] [-webkit-touch-callout:none]" : "inset-1.5 rounded-[22px] hover:-translate-y-0.5 sm:inset-[7px]"
        }`}
        style={{
          background: "rgb(var(--surface-rgb) / .62)",
          border: selected ? "2px solid var(--ink)" : "1px solid rgb(var(--rim-rgb) / .75)",
          backdropFilter: "blur(22px) saturate(1.35)",
          WebkitBackdropFilter: "blur(22px) saturate(1.35)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {tile && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((open) => !open);
            }}
            aria-label={menuOpen ? "Close actions" : `Actions for ${link.title}`}
            data-tour="card-menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={`absolute right-1.5 top-1.5 z-30 flex h-7 w-7 items-center justify-center rounded-full text-[15px] font-bold leading-none ${
              menuOpen ? "bg-white/15 text-[#f4f5f6]" : "bg-surface/85 text-ink shadow-sm"
            }`}
            style={{ backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
          >
            {menuOpen ? "✕" : "⋯"}
          </button>
        )}
        {tile && !menuOpen && !selectionActive && (
          <a
            href={link.url}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Open ${link.domain} in a new tab`}
            className="absolute left-1.5 top-1.5 z-30 flex h-7 w-7 items-center justify-center rounded-full bg-surface/85 text-ink shadow-sm"
            style={{ backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
              <path d="M7 17 17 7M9 7h8v8" />
            </svg>
          </a>
        )}
        {menuOpen && (
          <div
            role="menu"
            aria-label={`Actions for ${link.title}`}
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-0 z-20 flex flex-col justify-center gap-0.5 p-1.5"
            style={{
              background: "rgba(23,24,27,.84)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              animation: "card-menu-in .18s cubic-bezier(.2,.9,.3,1.2)",
            }}
          >
            <a role="menuitem" href={link.url} target="_blank" rel="noreferrer noopener" onClick={() => setMenuOpen(false)} className={MENU_ITEM}>
              <span className="w-4 text-center">↗</span> Open original
            </a>
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setFavorite(link.id, !link.favorite);
                setMenuOpen(false);
              }}
              className={MENU_ITEM}
            >
              <span className="w-4 text-center text-signal">★</span> {link.favorite ? "Unfavorite" : "Favorite"}
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={() => deleteLinks([link.id])}
              className={`${MENU_ITEM} text-[#ff9a8f]`}
            >
              <span className="w-4 text-center">✕</span> Move to trash
            </button>
          </div>
        )}
        {selectable && (
          <button
            type="button"
            data-tour="card-select"
            onClick={(e) => {
              e.stopPropagation();
              onSelectClick?.(e);
            }}
            aria-label={selected ? "Deselect" : "Select"}
            className={`absolute left-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-opacity ${
              selected ? "bg-lime text-on-accent opacity-100" : "bg-surface/80 text-transparent opacity-0 group-hover:opacity-100"
            }`}
          >
            ✓
          </button>
        )}

        {hero && (
          <div
            className={`relative overflow-hidden bg-[#dfe2e5] dark:bg-[#26272b] ${
              tile ? "m-1.5 mb-0 h-[54px] flex-none rounded-[11px]" : "m-2 mb-0 min-h-0 flex-1 rounded-[18px]"
            }`}
          >
            {link.heroImage ? (
              <>
                <Image
                  src={link.heroImage}
                  alt=""
                  fill
                  sizes="(min-width: 1280px) 25vw, 50vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/28 to-transparent to-55%" />
              </>
            ) : (
              <div className="absolute inset-0" style={{ background: link.tint }}>
                <div
                  className="absolute left-1/2 top-1/2 h-[170px] w-[170px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{ background: link.stripe, opacity: 0.28 }}
                />
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `repeating-linear-gradient(180deg, ${link.stripe} 0 6px, transparent 6px 19px)`,
                  }}
                />
              </div>
            )}
            {!tile && link.tags.length > 0 && (
              <div className="absolute left-2.5 top-2.5 flex gap-1.5">
                {link.tags.slice(0, 1).map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-surface/75 px-2.5 py-1 text-[10px] font-medium text-ink backdrop-blur-sm"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className={`flex min-w-0 flex-none flex-col ${tile ? "gap-1 px-2.5 py-2" : "gap-2 px-4 py-3.5"}`}>
          <div className={`flex min-w-0 items-center ${tile ? "gap-1.5" : "gap-2"}`}>
            <span
              className={`flex flex-none items-center justify-center font-bold ${
                tile ? "h-[14px] w-[14px] rounded-[4px] text-[8px]" : "h-[18px] w-[18px] rounded-[6px] text-[9px]"
              }`}
              style={{ color: link.stripe, background: link.tint }}
            >
              {link.initial}
            </span>
            <span className={`truncate text-ink/50 ${tile ? "text-[10.5px]" : "text-[11.5px]"}`}>{link.domain}</span>
            {!tile && (
              // The one action people hunt for, so it's always on screen and sits right
              // by the domain it opens — apart from the hover-only controls panel.
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer noopener"
                onClick={(e) => e.stopPropagation()}
                data-tour="card-open"
                title={`Open ${link.domain} in a new tab`}
                aria-label={`Open ${link.domain} in a new tab`}
                className="flex h-7 flex-none items-center gap-1 rounded-full border border-ink/12 bg-surface/70 pl-2 pr-2.5 text-[11.5px] font-semibold text-ink/75 transition-colors hover:border-ink hover:bg-ink hover:text-on-ink"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
                  <path d="M7 17 17 7M9 7h8v8" />
                </svg>
                Open
              </a>
            )}
            {link.favorite && <span className={`ml-auto leading-none text-signal ${tile ? "text-[11px]" : "text-[13px]"}`}>★</span>}
          </div>
          <div
            className="overflow-hidden font-semibold leading-[1.12] text-ink"
            style={{
              fontSize: tile ? 13 : CARD_TITLE_SIZE[link.size],
              letterSpacing: tile ? "-.02em" : "-.038em",
              display: "-webkit-box",
              WebkitLineClamp: link.size === "L" ? 3 : 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {link.title}
          </div>
          {compact && link.tags.length > 0 && (
            <div className="flex gap-1.5">
              {link.tags.slice(0, 1).map((t) => (
                <span key={t} className="rounded-full bg-ink/6 px-2.5 py-1 text-[10px] font-medium text-ink/60">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {!tile && (
        // Hover controls, stacked down the right edge so they never cover the title,
        // domain or Open button.
        <div
          className="absolute right-2.5 top-2.5 z-10 flex flex-col items-center gap-0.5 rounded-full p-[3px] opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100"
          style={{ background: "rgb(var(--surface-rgb) / .8)", backdropFilter: "blur(10px)", boxShadow: "0 1px 4px rgba(0,0,0,.12)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div data-tour="card-size" className="flex flex-col gap-0.5">
            {SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setLinkSize(link.id, s)}
                aria-label={`Size ${s}`}
                aria-pressed={s === link.size}
                className="h-[22px] w-[22px] rounded-full text-[10px] font-semibold"
                style={{
                  background: s === link.size ? "var(--ink)" : "transparent",
                  color: s === link.size ? "var(--on-ink)" : "rgb(var(--ink-rgb) / .5)",
                }}
              >
                {s}
              </button>
            ))}
          </div>
          <span className="my-0.5 h-px w-3.5 bg-ink/15" />
          <button
            type="button"
            data-tour="card-favorite"
            onClick={() => setFavorite(link.id, !link.favorite)}
            title={link.favorite ? "Remove from favorites" : "Add to favorites"}
            aria-label={link.favorite ? "Remove from favorites" : "Add to favorites"}
            className={`flex h-[22px] w-[22px] items-center justify-center rounded-full text-[13px] leading-none hover:bg-ink/8 ${
              link.favorite ? "text-signal" : "text-ink/40"
            }`}
          >
            ★
          </button>
          {/* Soft delete — the link lands in Trash, same as the bulk action. */}
          <button
            type="button"
            onClick={() => deleteLinks([link.id])}
            data-tour="card-trash"
            title="Move to trash"
            aria-label={`Move ${link.title} to trash`}
            className="flex h-[22px] w-[22px] items-center justify-center rounded-full hover:bg-ink/8"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ stroke: "rgb(var(--ink-rgb) / .55)" }} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" />
            </svg>
          </button>
        </div>
        )}

        {!tile && (
        <div
          onPointerDown={handlePointerDown}
          data-tour="card-resize"
          title="Drag to resize"
          className="absolute bottom-0 right-0 h-[30px] w-[30px] touch-none cursor-nwse-resize opacity-0 transition-opacity group-hover:opacity-100"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, rgb(var(--ink-rgb) / .3) 0 1.5px, transparent 1.5px 5px)",
            backgroundPosition: "9px 9px",
            backgroundSize: "14px 14px",
            backgroundRepeat: "no-repeat",
          }}
        />
        )}
      </div>
    </div>
  );
}
