"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { identityForDomain } from "@/lib/card-identity";

/** Landing "a URL is just the beginning": pick a link type, see the card AnyLink reads out of it. */

type Preset = {
  icon: "article" | "video" | "cart" | "x";
  label: string;
  url: string;
  title: string;
  body: string;
  tags: string[];
  meta: string;
  image: string;
  /** Product shots — cut-outs sit on a soft gradient instead of filling the frame. */
  cutout?: boolean;
  thumbs?: string[];
};

const PRESETS: Preset[] = [
  {
    icon: "article",
    label: "Article",
    url: "https://www.cntraveler.com/gallery/best-hotels-in-portugal",
    title: "The dreamiest hotels in Portugal",
    body: "From cliffside pousadas to Lisbon palaces — 24 stays worth planning a trip around.",
    tags: ["Travel", "Portugal", "Hotels"],
    meta: "8 min read",
    image: "/images/demo/villa.webp",
  },
  {
    icon: "video",
    label: "Video",
    url: "https://www.youtube.com/watch?v=weekend-in-barcelona",
    title: "A weekend in Barcelona",
    body: "Beach mornings, Gaudí afternoons and where to eat after midnight.",
    tags: ["Travel", "Vlog", "Barcelona"],
    meta: "12:48",
    image: "/images/demo/barcelona.webp",
  },
  {
    icon: "cart",
    label: "Product",
    url: "https://www.newbalance.com/pd/1906r/M1906R.html",
    title: "1906R",
    body: "The 1906R reimagines early 2000s running DNA with modern comfort and premium materials.",
    tags: ["Sneakers", "New Balance", "Lifestyle"],
    meta: "$160",
    image: "/images/hero/sneaker.webp",
    cutout: true,
    thumbs: ["/images/hero/sneaker.webp", "/images/demo/sneakers.webp", "/images/hero/sneaker.webp"],
  },
  {
    icon: "x",
    label: "Post",
    url: "https://x.com/designnotes/status/1906",
    title: "“Less, but better.” Still the best design brief ever written.",
    body: "Dieter Rams’ ten principles, one thread — with the products that earned them.",
    tags: ["Design", "Thread"],
    meta: "2.4k likes",
    image: "/images/demo/book.webp",
  },
];

export function UrlPreview() {
  const router = useRouter();
  const [preset, setPreset] = useState(PRESETS[2]);
  const [url, setUrl] = useState(preset.url);
  const domain = new URL(preset.url).hostname.replace(/^www\./, "");
  const identity = identityForDomain(domain);

  const pick = (p: Preset) => {
    setPreset(p);
    setUrl(p.url);
  };

  return (
    <section id="features" className="grid grid-cols-[minmax(0,1fr)] items-center gap-10 pt-16 md:pt-24 md:grid-cols-[0.9fr_minmax(0,1.1fr)]">
      <div className="flex flex-col gap-6">
        <h2 className="text-display text-[40px] leading-[0.98] sm:text-[56px]">
          A URL is just
          <br />
          the beginning.
        </h2>
        <p className="max-w-[440px] text-[17px] leading-[1.5] text-ink/55">
          Paste a link and get a rich preview — title, image, description and more. AnyLink
          automatically cleans it up and saves the important stuff.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            router.push("/app");
          }}
          className="flex h-16 items-center gap-2 rounded-full bg-surface/80 pr-2 pl-6 shadow-card"
        >
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-label="Link to save"
            className="min-w-0 flex-1 bg-transparent text-body outline-none"
          />
          <button
            type="submit"
            aria-label="Save link"
            className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-signal text-white"
          >
            <Icon name="arrow-right" size={18} />
          </button>
        </form>
        <div className="flex gap-3">
          {PRESETS.map((p) => (
            <button
              key={p.icon}
              type="button"
              onClick={() => pick(p)}
              aria-label={`Show a ${p.label.toLowerCase()} preview`}
              aria-pressed={p === preset}
              className={`flex h-14 w-14 items-center justify-center rounded-[18px] shadow-card transition-colors ${
                p === preset ? "bg-ink text-on-ink" : "bg-surface/80 text-ink/70 hover:text-ink"
              }`}
            >
              <Icon name={p.icon} size={22} strokeWidth={p.icon === "x" ? undefined : 1.8} />
            </button>
          ))}
          <span
            title="…and anything else with a URL"
            className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-surface/80 text-ink/70 shadow-card"
          >
            <Icon name="more" size={20} />
          </span>
        </div>
      </div>

      {/* key remounts the card so each pick replays the entrance */}
      <div key={preset.icon} className="card-enter flex flex-col gap-4 rounded-panel bg-paper p-4 shadow-window sm:p-5">
        <div className="flex gap-3">
          <div
            className="relative aspect-[4/3] min-w-0 flex-1 overflow-hidden rounded-card"
            style={
              preset.cutout
                ? { background: "radial-gradient(120% 90% at 70% 30%, rgb(214 242 75 / .35), transparent 60%), radial-gradient(90% 90% at 10% 100%, rgb(255 90 31 / .18), transparent 60%), rgb(var(--ink-rgb) / .03)" }
                : undefined
            }
          >
            <Image
              src={preset.image}
              alt=""
              fill
              sizes="(min-width: 768px) 480px, 90vw"
              className={preset.cutout ? "-rotate-6 object-contain p-8" : "object-cover"}
            />
            <span className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-paper/85 py-1 pr-3 pl-1 text-meta text-ink/60 backdrop-blur">
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold"
                style={{ background: identity.tint, color: identity.stripe }}
              >
                {identity.initial}
              </span>
              {domain}
            </span>
            {preset.icon === "video" && (
              <span className="absolute top-1/2 left-1/2 flex h-14 w-14 -translate-1/2 items-center justify-center rounded-full bg-signal text-white shadow-window">
                <svg viewBox="0 0 24 24" className="ml-1 h-6 w-6" fill="currentColor" aria-hidden>
                  <path d="M7 4.5v15l12-7.5z" />
                </svg>
              </span>
            )}
          </div>
          {preset.thumbs && (
            <div className="hidden w-[22%] flex-col gap-3 sm:flex">
              {preset.thumbs.map((src, i) => (
                <div key={i} className="relative flex-1 overflow-hidden rounded-[16px] bg-ink/5">
                  <Image
                    src={src}
                    alt=""
                    fill
                    sizes="120px"
                    // Same cut-out twice reads as two angles once one is mirrored.
                    className={src.includes("/hero/") ? `object-contain p-2 ${i === 2 ? "-scale-x-100" : ""}` : "object-cover"}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 px-1">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="text-hero text-[28px] leading-tight sm:text-[34px]">{preset.title}</h3>
            <span className="text-body whitespace-nowrap text-ink/45">{preset.meta}</span>
          </div>
          <p className="max-w-[440px] text-lead text-ink/55">{preset.body}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-1">
          {preset.tags.map((t) => (
            <span key={t} className="rounded-full bg-ink/6 px-3 py-1.5 text-meta text-ink/60">
              {t}
            </span>
          ))}
          <Link
            href="/app"
            className="ml-auto flex h-12 items-center rounded-full bg-ink px-6 text-body font-semibold text-on-ink"
          >
            Save to library
          </Link>
        </div>
      </div>
    </section>
  );
}
