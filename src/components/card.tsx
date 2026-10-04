"use client";

import { Icon } from "@/components/icon";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { useLibrary } from "@/lib/store";
import { LinkActionSheet } from "./link-action-sheet";
import { swallowClick, type useDragReorder } from "@/lib/use-drag-reorder";
import { CARD_GEOMETRY, CARD_TITLE_SIZE, GRID_ROW_UNIT, TILE_PX, sizeFromDrag } from "@/lib/geometry";
import { CARD_SIZES, type LinkItem } from "@/lib/types";

const ROW_PX = 46;
const ENTRANCE_SCALES = [0.72, 1.14, 0.86, 1.22, 0.64, 1.06];
const ISLAND = "pointer-events-auto flex gap-1 rounded-full p-1";
const ISLAND_STYLE = {
  background: "rgb(var(--surface-rgb) / .96)",
  border: "1px solid rgb(var(--ink-rgb) / .12)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  boxShadow: "0 4px 14px rgba(0,0,0,.18), 0 1px 3px rgba(0,0,0,.12)",
};

export function Card({
  index = 0,
  link,
  columnCount,
  tile = false,
  row = false,
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
  /** Phone list view: a one-line row of the tile, same ⋯ control. */
  row?: boolean;
  selectable?: boolean;
  selectionActive?: boolean;
  selected?: boolean;
  onSelectClick?: (e: React.MouseEvent) => void;
  dragging?: boolean;
  /** From useDragReorder's `item(id)` — the FLIP ref plus, when reorderable, the drag handlers. */
  dragProps?: ReturnType<ReturnType<typeof useDragReorder>["item"]>;
}) {
  const router = useRouter();
  const { setLinkSize, setFavorite, deleteLinks, demo } = useLibrary();
  const cardRef = useRef<HTMLDivElement>(null);
  const [resizing, setResizing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Set when the menu came from a right-click: it opens at the pointer, not as a sheet.
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | undefined>();
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setMenuAt(undefined);
  }, []);
  const geo = CARD_GEOMETRY[link.size];
  const cols = tile ? 1 : Math.min(geo.cols, columnCount);
  const rows = Math.round((row ? ROW_PX : tile ? TILE_PX : geo.rowPx) / GRID_ROW_UNIT);
  const hero = !row && (tile || link.size !== "S");
  const compact = !tile && link.size === "S";

  const handleOpen = (e: React.MouseEvent) => {
    if (selectable && selectionActive) {
      onSelectClick?.(e);
      return;
    }
    // Demo links have no detail page — show the real thing instead.
    if (demo) window.open(link.url, "_blank", "noopener");
    else router.push(`/links/${link.id}`);
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
        onContextMenu={(e) => {
          // Phone tiles: a long press lifts the tile to drag, and ⋯ is the menu.
          if (tile) return;
          e.preventDefault();
          setMenuAt({ x: e.clientX, y: e.clientY });
          setMenuOpen(true);
        }}
        role="button"
        tabIndex={0}
        className={`group absolute flex cursor-pointer overflow-hidden ${row ? "flex-row items-center" : "flex-col"} transition-[box-shadow,transform] ${
          tile ? `${row ? "inset-x-0 inset-y-[2px] rounded-[12px]" : "inset-1 rounded-[16px]"} select-none [-webkit-touch-callout:none]` : "inset-1.5 rounded-[22px] hover:-translate-y-0.5 sm:inset-[7px]"
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
          // 44px tap target around a 28px dot, per the iOS minimum.
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(true);
            }}
            aria-label={`Actions for ${link.title}`}
            data-tour="card-menu"
            aria-haspopup="dialog"
            className={`absolute z-30 flex h-11 w-11 items-center justify-center ${row ? "right-0 top-1/2 -translate-y-1/2" : "right-0 top-0"}`}
          >
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full bg-surface/85 text-ink shadow-sm"
              style={{ backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
            >
              <Icon name="more" size={15} />
            </span>
          </button>
        )}
        {menuOpen && <LinkActionSheet link={link} onClose={closeMenu} at={menuAt} />}
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
            <Icon name="check" size={12} />
          </button>
        )}

        {hero && (
          <div
            className={`relative overflow-hidden bg-[#dfe2e5] dark:bg-[#26272b] ${
              tile ? "m-1.5 mb-0 h-[54px] flex-none rounded-[11px]" : "m-2 mb-0 min-h-0 flex-1 rounded-[18px]"
            }`}
          >
            <HeroArt link={link} />
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

        {row ? (
          <div className="flex min-w-0 flex-1 items-center gap-2 pl-2.5 pr-11">
            <span
              className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[7px] text-[10px] font-bold"
              style={{ color: link.stripe, background: link.tint }}
            >
              {link.initial}
            </span>
            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold tracking-[-.02em] text-ink">{link.title}</span>
            {link.favorite && <Icon name="star" size={11} className="flex-none text-signal" />}
          </div>
        ) : (
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
            {link.favorite && <Icon name="star" size={tile ? 11 : 13} className="ml-auto text-signal" />}
          </div>
          <div
            className="overflow-hidden font-semibold leading-[1.12] text-ink"
            style={{
              fontSize: tile ? 13 : CARD_TITLE_SIZE[link.size],
              letterSpacing: tile ? "-.02em" : "-.038em",
              display: "-webkit-box",
              // A tile only has room for two lines whatever size the card is on desktop.
              WebkitLineClamp: !tile && link.size === "L" ? 3 : 2,
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
        )}

        {!tile && (
        // Hover controls: two floating islands — sizes and actions — lined up on the right
        // edge so they never cover the title, domain or Open button. Stacked top/bottom on
        // tall cards; on S (no image) they lie flat in the bottom-right corner, clear of the
        // domain row and its Open button.
        <div
          className={`pointer-events-none absolute z-10 flex opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 ${
            compact ? "bottom-2 right-9 gap-1.5" : "bottom-[34px] right-2.5 top-2.5 flex-col items-end justify-between"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div data-tour="card-size" className={`${ISLAND} ${compact ? "" : "flex-col"}`} style={ISLAND_STYLE}>
          {CARD_SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setLinkSize(link.id, s)}
              aria-label={`Size ${s}`}
              aria-pressed={s === link.size}
              className={`h-7 w-7 rounded-full text-[11px] font-semibold transition-colors ${
                s === link.size ? "bg-ink text-on-ink" : "text-ink/75 hover:bg-lime hover:text-on-accent"
              }`}
            >
              {s}
            </button>
          ))}
          </div>
          <div className={`${ISLAND} ${compact ? "" : "flex-col"}`} style={ISLAND_STYLE}>
          <button
            type="button"
            data-tour="card-favorite"
            onClick={() => setFavorite(link.id, !link.favorite)}
            title={link.favorite ? "Remove from favorites" : "Add to favorites"}
            aria-label={link.favorite ? "Remove from favorites" : "Add to favorites"}
            className={`flex h-7 w-7 items-center justify-center rounded-full text-[16px] leading-none transition-colors hover:bg-amber-400/15 hover:text-amber-400 ${
              link.favorite ? "text-signal" : "text-ink/60"
            }`}
          >
            <Icon name="star" size={16} />
          </button>
          {/* Soft delete — the link lands in Trash, same as the bulk action. */}
          <button
            type="button"
            onClick={() => deleteLinks([link.id])}
            data-tour="card-trash"
            title="Move to trash"
            aria-label={`Move ${link.title} to trash`}
            className="flex h-7 w-7 items-center justify-center rounded-full text-ink/70 transition-colors hover:bg-red-500/12 hover:text-red-500"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" />
            </svg>
          </button>
          </div>
        </div>
        )}

        {!tile && (
        <div
          onPointerDown={handlePointerDown}
          data-tour="card-resize"
          title="Drag to resize"
          className="absolute bottom-0 right-0 z-10 h-[30px] w-[30px] touch-none cursor-nwse-resize opacity-0 transition-opacity group-hover:opacity-100"
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

/** The hero image, or the striped identity fallback most imported links get. Fills its
 * (relative, sized) parent. */
export function HeroArt({ link, sizes = "(min-width: 1280px) 25vw, 50vw" }: { link: LinkItem; sizes?: string }) {
  return link.heroImage ? (
    <>
      <Image src={link.heroImage} alt="" fill sizes={sizes} className="object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/28 to-transparent to-55%" />
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
  );
}
