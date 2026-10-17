"use client";

import { useState } from "react";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { identityForDomain } from "@/lib/card-identity";
import villa from "../../public/images/demo/villa.webp";
import barcelona from "../../public/images/demo/barcelona.webp";
import book from "../../public/images/demo/book.webp";
import sneaker from "../../public/images/hero/sneaker.webp";

/** Landing "a URL is just the beginning": pick a link type, see the card AnyLink reads out
 *  of it — exploded into its layers until hovered. Styled by app/landing.css. */

type Preset = {
  label: string;
  icon: React.ReactNode;
  url: string;
  title: string;
  body: string;
  tags: string[];
  meta: string;
  /** Layer 03's callout: what `meta` is and where it came from. */
  metaLab: string;
  metaNote: string;
  image: StaticImageData;
  video?: boolean;
  /** Product shots — a faded cut-out in the frame, the real one floating above. */
  cutout?: boolean;
};

const PRESETS: Preset[] = [
  {
    label: "article",
    icon: <path d="M6.5 3.5h7.5l4 4v13h-11.5zM14 3.5v4h4M9.5 12h5M9.5 15.5h5" />,
    url: "https://www.cntraveler.com/gallery/best-hotels-in-portugal",
    title: "The dreamiest hotels in Portugal",
    body: "From cliffside pousadas to Lisbon palaces — 24 stays worth planning a trip around.",
    tags: ["Travel", "Portugal", "Hotels"],
    meta: "8 min read",
    metaLab: "Read time",
    metaNote: "Read from the page",
    image: villa,
  },
  {
    label: "video",
    icon: (
      <>
        <rect x="3.5" y="5.5" width="17" height="13" rx="3.5" />
        <path d="M10.5 9.5v5l4-2.5z" />
      </>
    ),
    url: "https://www.youtube.com/watch?v=weekend-in-barcelona",
    title: "A weekend in Barcelona",
    body: "Beach mornings, Gaudí afternoons and where to eat after midnight.",
    tags: ["Travel", "Vlog", "Barcelona"],
    meta: "12:48",
    metaLab: "Length",
    metaNote: "Read from the video page",
    image: barcelona,
    video: true,
  },
  {
    label: "product",
    icon: (
      <>
        <path d="M3.5 4.5h2.2l2.1 10.2h9.7l2-7.2H6.6" />
        <circle cx="9.5" cy="19" r="1.3" />
        <circle cx="16.5" cy="19" r="1.3" />
      </>
    ),
    url: "https://www.newbalance.com/pd/1906r/M1906R.html",
    title: "1906R",
    body: "The 1906R reimagines early 2000s running DNA with modern comfort and premium materials.",
    tags: ["Sneakers", "New Balance", "Lifestyle"],
    meta: "$160",
    metaLab: "Price",
    metaNote: "Checked twice a day",
    image: sneaker,
    cutout: true,
  },
  {
    label: "post",
    icon: <path d="M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-6l-4.5 3.5v-3.5h-.5a2 2 0 0 1-2-2z" />,
    url: "https://x.com/designnotes/status/1906",
    title: "“Less, but better.” Still the best design brief ever written.",
    body: "Dieter Rams’ ten principles, one thread — with the products that earned them.",
    tags: ["Design", "Thread"],
    meta: "2.4k likes",
    metaLab: "Summary",
    metaNote: "Written for you",
    image: book,
  },
];

// The layer stack's soft shadows, cast onto the base card while it's exploded.
const SHADOWS = [
  { left: 44, top: 54, width: 430, height: 270 },
  { left: 46, top: 344, width: 430, height: 136 },
  { left: 46, top: 494, width: 430, height: 52 },
];

export function UrlPreview() {
  const router = useRouter();
  const [preset, setPreset] = useState(PRESETS[2]);
  const [url, setUrl] = useState(preset.url);
  const domain = new URL(preset.url).hostname.replace(/^www\./, "");
  const identity = identityForDomain(domain);

  return (
    <section className="sec" id="features">
      <div className="wrap pv-grid">
        <div className="pv-copy">
          <span className="eyebrow">
            <span className="dot" />
            Paste &amp; read
          </span>
          <h2 className="h2">
            A URL is just
            <br />
            <span className="it">the beginning.</span>
          </h2>
          <p className="lead">
            Paste a link and get a rich preview — title, image, description and more. AnyLink automatically cleans it
            up and saves the important stuff.
          </p>
          <form
            className="url"
            onSubmit={(e) => {
              e.preventDefault();
              router.push("/app");
            }}
          >
            <svg className="ic" viewBox="0 0 24 24" aria-hidden>
              <path d="M10 13.5a4.5 4.5 0 0 0 6.4.4l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.6 1.6" />
              <path d="M14 10.5a4.5 4.5 0 0 0-6.4-.4l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.6-1.6" />
            </svg>
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Link to save" />
            <button type="submit" className="url-go" aria-label="Save link">
              <svg className="ic" viewBox="0 0 24 24" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </form>
          <div className="presets">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className={p === preset ? "pre on" : "pre"}
                aria-pressed={p === preset}
                aria-label={`Show a ${p.label} preview`}
                onClick={() => {
                  setPreset(p);
                  setUrl(p.url);
                }}
              >
                <svg className="ic" viewBox="0 0 24 24" aria-hidden>
                  {p.icon}
                </svg>
              </button>
            ))}
            <span className="pre pre-more" title="…and anything else with a URL">
              <svg className="ic" viewBox="0 0 24 24" aria-hidden>
                <path d="M5.5 12h.01M12 12h.01M18.5 12h.01" style={{ strokeWidth: 3.4 }} />
              </svg>
              <span className="vh">…and anything else with a URL</span>
            </span>
          </div>
        </div>

        <div className="xp-stage">
          <div className="xp-fly">
            <div className="xp light">
              <div className="xl xl-0">
                {[0, 1, 2, 3].map((i) => (
                  <i key={i} className="xp-edge" />
                ))}
                <div className="xp-base" />
                {SHADOWS.map((s, i) => (
                  <span key={i} className="xs" style={s} />
                ))}
                <Label n="01 · Your card" note="S, M or L — your call" />
              </div>
              <div className="xl xl-1">
                <div className="x-slab x-act">
                  {preset.tags.map((t) => (
                    <span key={t} className="x-tag">
                      {t}
                    </span>
                  ))}
                  <Link className="x-save" href="/app">
                    Save to library
                  </Link>
                </div>
                <Label n="02 · Tags" note="Suggested, never forced" />
              </div>
              <div className="xl xl-2">
                <div className="x-slab x-text">
                  <div className="x-row">
                    <p className="x-title">{preset.title}</p>
                    <span className="x-meta">{preset.meta}</span>
                  </div>
                  <p className="x-body">{preset.body}</p>
                </div>
                <Label n={`03 · ${preset.metaLab}`} note={preset.metaNote} />
              </div>
              <div className="xl xl-3">
                <div className={preset.cutout ? "x-img cut" : "x-img"}>
                  <Image src={preset.image} alt="" sizes="440px" />
                  <span className="x-chip">
                    <span className="bdg" style={{ color: identity.stripe, background: identity.tint }}>
                      {identity.initial}
                    </span>
                    {domain}
                  </span>
                  {preset.video && (
                    <span className="x-play">
                      <svg className="ic fill" viewBox="0 0 24 24" aria-hidden>
                        <path d="M8 5.5v13l10.5-6.5z" />
                      </svg>
                    </span>
                  )}
                </div>
                <Label n="04 · Image" note="The best one on the page" />
              </div>
              {preset.cutout && (
                <div className="xl xl-4">
                  <Image className="x-float" src={preset.image} alt="" sizes="370px" />
                </div>
              )}
            </div>
          </div>
          <div className="xp-hint" aria-hidden>
            hover to put it back together
            <svg viewBox="0 0 40 30" style={{ width: 34, height: 26, fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" }}>
              <path d="M4 26C10 10 22 4 36 6M36 6l-9-4M36 6l-6 8" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}

function Label({ n, note }: { n: string; note: string }) {
  return (
    <div className="xlab">
      <b>{n}</b>
      <span>{note}</span>
    </div>
  );
}
