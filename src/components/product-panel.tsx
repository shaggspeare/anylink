"use client";

import { Icon } from "@/components/icon";
import { useState } from "react";
import Image from "next/image";
import { useLibrary } from "@/lib/store";
import type { LinkItem } from "@/lib/types";

export function ProductPanel({ link }: { link: LinkItem }) {
  const product = link.product!;
  const { setAlertThreshold } = useLibrary();
  const [showAllSpecs, setShowAllSpecs] = useState(false);
  const [threshold, setThreshold] = useState(product.alertThreshold ?? product.price ?? 0);

  const changePct =
    product.previousPrice && product.price
      ? Math.round(((product.price - product.previousPrice) / product.previousPrice) * 100)
      : 0;
  const specsToShow = showAllSpecs ? product.specs : product.specs.slice(0, 8);

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:items-start">
      <article
        data-tour="product"
        className="flex-1 overflow-hidden rounded-[28px]"
        style={{ background: "rgb(var(--surface-rgb) / .72)", border: "1px solid rgb(var(--rim-rgb) / .85)", backdropFilter: "blur(22px)" }}
      >
        <div className="flex flex-col gap-5 border-b border-ink/6 p-5 sm:flex-row sm:p-6">
          <div className="relative h-[200px] w-full flex-none overflow-hidden rounded-[20px] bg-white shadow-[0_10px_26px_-14px_rgba(23,24,27,.4)] sm:w-[180px]">
            {link.heroImage && <Image src={link.heroImage} alt="" fill sizes="180px" className="object-cover" />}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex items-center gap-2">
              <span
                className="flex h-5 w-5 items-center justify-center rounded-[6px] text-[10px] font-bold text-white"
                style={{ background: product.retailerColor }}
              >
                {product.retailerInitial}
              </span>
              <span className="text-[11.5px] text-ink/50">
                {product.retailer}
                {product.code ? ` · code ${product.code}` : ""}
              </span>
            </div>
            <div className="text-[26px] font-semibold leading-[1.1] tracking-[-.04em] text-ink text-pretty sm:text-[28px]">
              {link.title}
            </div>
            {product.price !== undefined && (
              <div className="flex items-baseline gap-3">
                <span className="text-[28px] font-semibold tracking-[-.04em] text-ink sm:text-[30px]">
                  {product.currency}
                  {product.price.toLocaleString()}
                </span>
                {product.previousPrice && (
                  <span className="text-[15px] text-ink/40 line-through">
                    {product.currency}
                    {product.previousPrice.toLocaleString()}
                  </span>
                )}
                {changePct !== 0 && (
                  <span className="rounded-full bg-lime px-2.5 py-1 text-[11.5px] font-bold text-on-accent">
                    {changePct}% since saved
                  </span>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {product.inStock !== undefined && (
                <StatusChip active={product.inStock}>{product.inStock ? "In stock" : "Out of stock"}</StatusChip>
              )}
              {product.delivery && <StatusChip>{product.delivery}</StatusChip>}
              {product.rating !== undefined && (
                <StatusChip>
                  {product.rating} <Icon name="star" size={11} className="inline-block align-[-1px]" />{product.reviewCount ? ` · ${product.reviewCount.toLocaleString()} reviews` : ""}
                </StatusChip>
              )}
              {product.warranty && <StatusChip>{product.warranty}</StatusChip>}
            </div>
            {product.variants.length > 0 && (
              <div className="mt-0.5 flex gap-1.5">
                {product.variants.map((v, i) => (
                  <span
                    key={v.label}
                    title={v.label}
                    className="h-[30px] w-[30px] rounded-[9px]"
                    style={{
                      background: v.swatch,
                      boxShadow: i === 0 ? "0 0 0 2px var(--ink), 0 0 0 4px rgb(var(--surface-rgb) / .9)" : undefined,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {product.specs.length > 0 && (
          <div className="flex flex-col gap-3 p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-periwinkle" />
              <span className="text-eyebrow text-ink/45">Specs AnyLink pulled</span>
              {product.specs.length > 8 && (
                <button
                  type="button"
                  onClick={() => setShowAllSpecs((v) => !v)}
                  className="ml-auto text-[11.5px] text-ink/45"
                >
                  {specsToShow.length} of {product.totalSpecCount} shown ·{" "}
                  <span className="font-semibold text-ink">{showAllSpecs ? "show less" : "show all"}</span>
                </button>
              )}
            </div>
            <div className="grid gap-x-6 sm:grid-cols-2">
              {specsToShow.map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-3.5 border-b border-ink/6 py-2.5 text-[13px]">
                  <span className="text-ink/55">{s.label}</span>
                  <span className="text-right font-semibold text-ink">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </article>

      <aside className="flex w-full flex-none flex-col gap-4 lg:w-[320px]">
        <div
          data-tour="price-history"
          className="flex flex-col gap-3 rounded-[22px] p-4"
          style={{ background: "rgb(var(--surface-rgb) / .55)", border: "1px solid rgb(var(--rim-rgb) / .8)", backdropFilter: "blur(20px) saturate(1.4)" }}
        >
          <span className="text-eyebrow text-ink/40">Price history</span>
          {product.priceHistory.length >= 2 ? (
            <PriceChart history={product.priceHistory} currency={product.currency} />
          ) : (
            <p className="text-body text-ink/45">
              Checked twice daily — history will show up after the next check.
            </p>
          )}
          <div data-tour="price-alert" className="flex flex-col gap-1.5 border-t border-ink/6 pt-3">
            <span className="text-[12px] font-medium text-ink/60">Alert me under</span>
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-ink/50">{product.currency}</span>
              <input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                onBlur={() => setAlertThreshold(link.id, threshold)}
                className="h-9 w-full rounded-[10px] border border-ink/10 bg-surface/70 px-2.5 text-[13px] text-ink outline-none"
              />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function StatusChip({ active, children }: { active?: boolean; children: React.ReactNode }) {
  return (
    <span
      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-ink"
      style={{ background: active ? "rgba(0,160,70,.14)" : "rgb(var(--ink-rgb) / .06)" }}
    >
      {active && <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#00a046" }} />}
      {children}
    </span>
  );
}

function PriceChart({ history, currency }: { history: { date: string; price: number }[]; currency: string }) {
  const width = 260;
  const height = 80;
  const prices = history.map((h) => h.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const points = history.map((h, i) => {
    const x = (i / (history.length - 1)) * width;
    const y = height - ((h.price - min) / range) * height;
    return `${x},${y}`;
  });

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        <polyline points={points.join(" ")} fill="none" stroke="#7c8cff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => {
          const [x, y] = p.split(",");
          return <circle key={i} cx={x} cy={y} r="2.6" fill="#7c8cff" />;
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-ink/40">
        <span>
          {currency}
          {min.toLocaleString()}
        </span>
        <span>
          {currency}
          {max.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
