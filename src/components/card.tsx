"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import Image from "next/image";
import { useLibrary } from "@/lib/store";
import { CARD_GEOMETRY, CARD_TITLE_SIZE, GRID_ROW_UNIT, sizeFromDrag } from "@/lib/geometry";
import type { CardSize, LinkItem } from "@/lib/types";

const SIZES: CardSize[] = ["S", "M", "L"];

/** Present only while the mosaic is in manual order — that's what turns a card draggable. */
export type CardDrag = {
  dragging: boolean;
  over: boolean;
  onStart: () => void;
  onOver: () => void;
  onDrop: () => void;
  onEnd: () => void;
};

export function Card({
  link,
  columnCount,
  selectable = false,
  selectionActive = false,
  selected = false,
  onSelectClick,
  drag,
}: {
  link: LinkItem;
  columnCount: number;
  selectable?: boolean;
  selectionActive?: boolean;
  selected?: boolean;
  onSelectClick?: (e: React.MouseEvent) => void;
  drag?: CardDrag;
}) {
  const router = useRouter();
  const { setLinkSize, setFavorite } = useLibrary();
  const cardRef = useRef<HTMLDivElement>(null);
  const geo = CARD_GEOMETRY[link.size];
  const cols = Math.min(geo.cols, columnCount);
  const rows = Math.round(geo.rowPx / GRID_ROW_UNIT);
  const hero = link.size !== "S";
  const compact = link.size === "S";

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
    const rect = el.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const unit = rect.width / cols;
    let lastSize = link.size;

    const move = (ev: PointerEvent) => {
      const w = rect.width + (ev.clientX - startX);
      const h = rect.height + (ev.clientY - startY);
      const next = sizeFromDrag(w, h, unit);
      if (next !== lastSize) {
        lastSize = next;
        setLinkSize(link.id, next);
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      style={{
        position: "relative",
        gridColumn: `span ${cols}`,
        gridRow: `span ${rows}`,
        opacity: drag?.dragging ? 0.35 : 1,
      }}
      // Native HTML5 drag — the resize handle calls preventDefault on pointerdown, so
      // grabbing the corner still resizes instead of starting a drag.
      draggable={Boolean(drag)}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", link.url);
        drag?.onStart();
      }}
      onDragOver={(e) => {
        if (!drag) return;
        e.preventDefault();
        drag.onOver();
      }}
      onDrop={(e) => {
        if (!drag) return;
        e.preventDefault();
        drag.onDrop();
      }}
      onDragEnd={() => drag?.onEnd()}
    >
      <div
        ref={cardRef}
        data-tour="card"
        onClick={handleOpen}
        role="button"
        tabIndex={0}
        className="group absolute inset-1.5 flex cursor-pointer flex-col overflow-hidden rounded-[22px] transition-[box-shadow,transform] hover:-translate-y-0.5 sm:inset-[7px]"
        style={{
          background: "rgba(255,255,255,.62)",
          border: drag?.over
            ? "2px dashed rgba(23,24,27,.55)"
            : selected
              ? "2px solid var(--ink)"
              : "1px solid rgba(255,255,255,.75)",
          backdropFilter: "blur(22px) saturate(1.35)",
          WebkitBackdropFilter: "blur(22px) saturate(1.35)",
          boxShadow: "var(--shadow-card)",
        }}
      >
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
              selected ? "bg-lime text-ink opacity-100" : "bg-white/80 text-transparent opacity-0 group-hover:opacity-100"
            }`}
          >
            ✓
          </button>
        )}

        {hero && (
          <div className="relative m-2 mb-0 min-h-0 flex-1 overflow-hidden rounded-[18px] bg-[#dfe2e5]">
            {link.heroImage ? (
              <>
                <Image
                  src={link.heroImage}
                  alt=""
                  fill
                  sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
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
            {link.tags.length > 0 && (
              <div className="absolute left-2.5 top-2.5 flex gap-1.5">
                {link.tags.slice(0, 1).map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-white/75 px-2.5 py-1 text-[10px] font-medium text-ink backdrop-blur-sm"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-none flex-col gap-2 px-4 py-3.5">
          <div className="flex items-center gap-2">
            <span
              className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[6px] text-[9px] font-bold"
              style={{ color: link.stripe, background: link.tint }}
            >
              {link.initial}
            </span>
            <span className="text-[11.5px] text-ink/50">{link.domain}</span>
            <button
              type="button"
              data-tour="card-favorite"
              onClick={(e) => {
                e.stopPropagation();
                setFavorite(link.id, !link.favorite);
              }}
              aria-label={link.favorite ? "Remove from favorites" : "Add to favorites"}
              className={`ml-auto text-[13px] leading-none transition-opacity ${
                link.favorite ? "text-signal" : "text-ink/30 opacity-0 group-hover:opacity-100"
              }`}
            >
              ★
            </button>
            <svg
              className="ml-1.5 opacity-0 transition-opacity group-hover:opacity-100"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(23,24,27,.35)"
              strokeWidth="2.6"
              strokeLinecap="round"
            >
              <path d="M7 17 17 7M9 7h8v8" />
            </svg>
          </div>
          <div
            className="overflow-hidden font-semibold leading-[1.12] text-ink"
            style={{
              fontSize: CARD_TITLE_SIZE[link.size],
              letterSpacing: "-.038em",
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

        <div
          data-tour="card-size"
          className="absolute right-4 top-4 flex gap-0.5 rounded-full p-[3px] opacity-0 transition-opacity group-hover:opacity-100"
          style={{ background: "rgba(255,255,255,.72)", backdropFilter: "blur(10px)", boxShadow: "0 1px 4px rgba(0,0,0,.12)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setLinkSize(link.id, s)}
              className="h-[21px] w-[23px] rounded-full text-[10px] font-semibold"
              style={{
                background: s === link.size ? "var(--ink)" : "transparent",
                color: s === link.size ? "#f4f5f6" : "rgba(23,24,27,.5)",
              }}
            >
              {s}
            </button>
          ))}
        </div>

        <div
          onPointerDown={handlePointerDown}
          title="Drag to resize"
          className="absolute bottom-0 right-0 h-[30px] w-[30px] cursor-nwse-resize opacity-0 transition-opacity group-hover:opacity-100"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, rgba(23,24,27,.3) 0 1.5px, transparent 1.5px 5px)",
            backgroundPosition: "9px 9px",
            backgroundSize: "14px 14px",
            backgroundRepeat: "no-repeat",
          }}
        />
      </div>
    </div>
  );
}
