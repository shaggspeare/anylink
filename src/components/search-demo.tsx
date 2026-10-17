"use client";

import { useState } from "react";
import Image from "next/image";
import { searchLinks } from "@/lib/search";
import { toDemoLinks } from "@/lib/demo-library";
import type { ContentType, LinkItem } from "@/lib/types";

/** Landing "find that thing": the app's own search over a demo library, hits marked.
 *  Styled by app/landing.css; `light` keeps the sheet in daylight in either theme. */

const LINKS = toDemoLinks([
  ["A visual guide to Barcelona", "https://www.notboring.co/barcelona", "bcn-sunset", "article", ""],
  ["48 hours in Barcelona", "https://www.cntraveler.com/story/48-hours-in-barcelona", "bcn-skyline", "article", ""],
  // Only the page text mentions Barcelona — the point of full-text search.
  ["Best coffee spots", "https://www.eater.com/maps/best-coffee-shops", "coffee", "article", "", {
    articleText: ["Our favourite is a tiny roaster in Barcelona’s Gràcia, pouring since 1998."],
  }],
  ["Barcelona photo diary", "https://www.youtube.com/watch?v=barcelona-photo-diary", "bcn-guell", "video", ""],
  ["New Balance 1906R", "https://www.newbalance.com/pd/1906r/M1906R.html", "sneakers", "product", ""],
  ["Leica M6", "https://leica-camera.com/en-int/photography/cameras/m/m6", "", "product", "", {
    heroImage: "/images/collections/everything.webp",
  }],
  ["Tokyo street photography", "https://petapixel.com/tokyo-street-photography", "tokyo", "article", ""],
  ["Ultimate Japan travel guide", "https://www.notion.so/japan-travel-guide", "kyoto", "article", ""],
  ["Dieter Rams: a legendary minimalist", "https://www.youtube.com/watch?v=dieter-rams", "book", "video", ""],
  ["The dreamiest hotels in Portugal", "https://www.cntraveler.com/gallery/best-hotels-in-portugal", "villa", "article", ""],
  ["Home office inspirations", "https://www.pinterest.com/ideas/home-office", "office", "article", ""],
  ["Sunset walks along the beach", "https://www.youtube.com/watch?v=beach-sunset-walks", "barcelona", "video", ""],
]);

const TYPES: { type: ContentType | "all"; label: string }[] = [
  { type: "all", label: "All" },
  { type: "article", label: "Articles" },
  { type: "product", label: "Products" },
  { type: "video", label: "Videos" },
];

const ORBS = [
  { left: -160, top: -180, width: 620, height: 620, background: "#ff5a1f", opacity: 0.3 },
  { right: -200, top: 260, width: 680, height: 680, background: "#d6f24b", opacity: 0.34 },
  { left: "30%", bottom: -320, width: 640, height: 640, background: "#7c8cff", opacity: 0.26 },
];

export function SearchDemo() {
  const [query, setQuery] = useState("barcelona");
  const [type, setType] = useState<ContentType | "all">("all");

  const matches = searchLinks(LINKS, query);
  const visible = type === "all" ? matches : matches.filter((l) => l.contentType === type);
  const count = (t: ContentType | "all") => (t === "all" ? matches.length : matches.filter((l) => l.contentType === t).length);
  // Words to mark; operators (type:video) never appear in the text.
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t && !t.includes(":"));

  return (
    <section className="sheet light" id="search">
      {ORBS.map((o, i) => (
        <span key={i} className="s-orb" style={o} aria-hidden />
      ))}
      <div className="wrap sheet-in">
        <div className="sec-head">
          <span className="eyebrow">
            <span className="dot" />
            Search
          </span>
          <h2 className="h2">
            Find that thing.
            <br />
            <span className="it">Instantly.</span>
          </h2>
          <p className="lead">
            One search for everything — titles, descriptions, and even text inside the page. Filter by type,
            collection or tag.
          </p>
        </div>
        <div className="s-controls">
          <label className="s-field">
            <svg className="ic" viewBox="0 0 24 24" aria-hidden>
              <circle cx="11" cy="11" r="6.5" />
              <path d="M20 20l-4.2-4.2" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search anything…"
              aria-label="Search the demo library"
            />
            {query && (
              <button type="button" className="s-x" aria-label="Clear search" onClick={() => setQuery("")}>
                <svg className="ic" viewBox="0 0 24 24" aria-hidden>
                  <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
                </svg>
              </button>
            )}
          </label>
          {TYPES.map((t) => (
            <button
              key={t.type}
              type="button"
              onClick={() => setType(t.type)}
              aria-pressed={type === t.type}
              disabled={t.type !== "all" && t.type !== type && count(t.type) === 0}
              className={type === t.type ? "s-chip on" : "s-chip"}
            >
              {t.label}
              {t.type !== "all" && <span className="n">{count(t.type)}</span>}
            </button>
          ))}
          {(query || type !== "all") && (
            <button
              type="button"
              className="s-clear"
              onClick={() => {
                setQuery("");
                setType("all");
              }}
            >
              Clear filters
            </button>
          )}
        </div>
        <div className="res-stage">
          <div className="res">
            {visible.map((l) => (
              <Result key={l.id} link={l} terms={terms} />
            ))}
            {!visible.length && <p className="s-empty">Nothing matches “{query}” — try “japan” or “coffee”.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

function Result({ link, terms }: { link: LinkItem; terms: string[] }) {
  const text = (link.articleText ?? []).join(" ");
  const term = terms.find((t) => text.toLowerCase().includes(t));
  const at = term ? text.toLowerCase().indexOf(term) : 0;
  // Found only in the page text: show where, under a magnifier.
  const lens = term && !terms.some((t) => link.title.toLowerCase().includes(t)) ? text.slice(Math.max(0, at - 6), at + term.length + 4) : null;
  const inText = lens !== null;

  return (
    <div className={inText ? "mc mc-m has-lens" : "mc mc-m"}>
      <div className="mc-in">
        <div className="mc-hero">
          {link.heroImage && <Image src={link.heroImage} alt="" fill sizes="(max-width: 760px) 90vw, 300px" />}
          {link.contentType === "video" && (
            <span className="mc-play">
              <svg className="ic fill" viewBox="0 0 24 24" aria-hidden>
                <path d="M8 5.5v13l10.5-6.5z" />
              </svg>
            </span>
          )}
        </div>
        <div className="mc-body">
          <div className="mc-src">
            <span className="bdg" style={{ color: link.stripe, background: link.tint }}>
              {link.initial}
            </span>
            <span className="mc-dom">{link.domain}</span>
            <a className="mc-open" href={link.url} target="_blank" rel="noreferrer noopener" aria-label={`Open ${link.domain} in a new tab`}>
              <svg className="ic" viewBox="0 0 24 24" aria-hidden>
                <path d="M7 17 17 7M9 7h8v8" />
              </svg>
              Open
            </a>
          </div>
          <div className="mc-title">
            <Marked text={link.title} terms={terms} />
          </div>
          {inText && (
            <div className="snip">
              <span className="eb">In the page</span>…<Marked text={text} terms={terms} />
            </div>
          )}
        </div>
      </div>
      {lens && (
        <div className="lens" aria-hidden>
          <span className="lens-h" />
          <div className="lens-in">
            <span className="lens-txt">
              <Marked text={lens} terms={terms} />
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/** `text` with every term wrapped in <mark>. */
function Marked({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return text;
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "i");
  // A capturing split puts the matches at the odd indexes.
  return text.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}
