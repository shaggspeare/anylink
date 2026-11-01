"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useLibrary } from "@/lib/store";
import { Chip } from "./chip";
import type { ContentType, LinkItem, TemplateData } from "@/lib/types";
import { clockLabel, hasProse, minutesLabel, readableParagraphs } from "@/lib/reader";
import { videoEmbedUrl } from "@/lib/crawler/url";
import { isPro } from "@/lib/plan";

/** The generic layout's last line: what Pro shows for this type (ios/docs/04-screens.md S15). It opens the Pro
 * dialog. */
const UPSELL: Partial<Record<ContentType, string>> = {
  article: "Pro adds the summary, the author and the date here.",
  video: "Pro plays the video right here.",
  recipe: "Pro turns this into a recipe: ingredients to tick off, numbered steps and the times.",
  product: "Pro tracks this price for you and charts its history.",
};

function withHighlights(paragraph: string, quotes: string[]) {
  if (quotes.length === 0) return paragraph;
  const pattern = quotes
    .filter((q) => paragraph.includes(q))
    .sort((a, b) => b.length - a.length);
  if (pattern.length === 0) return paragraph;
  let remaining = paragraph;
  const parts: React.ReactNode[] = [];
  let key = 0;
  while (remaining.length > 0) {
    const match = pattern.find((q) => remaining.includes(q));
    if (!match) {
      parts.push(remaining);
      break;
    }
    const idx = remaining.indexOf(match);
    if (idx > 0) parts.push(remaining.slice(0, idx));
    parts.push(
      <mark key={key++} className="rounded-[3px] bg-lime/60 px-0.5 text-on-accent">
        {match}
      </mark>
    );
    remaining = remaining.slice(idx + match.length);
  }
  return parts;
}

/** The generic layout (free), and Pro's article, video and recipe templates on top of it. */
export function ReaderPanel({
  link,
  onOpenCollection,
}: {
  link: LinkItem;
  onOpenCollection: () => void;
}) {
  const { links, addHighlight, plan, openPro } = useLibrary();
  const articleRef = useRef<HTMLDivElement>(null);
  const [popover, setPopover] = useState<{ x: number; y: number; text: string } | null>(null);

  const handleMouseUp = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (!selection || !text || !articleRef.current || selection.rangeCount === 0) {
      setPopover(null);
      return;
    }
    const range = selection.getRangeAt(0);
    if (!articleRef.current.contains(range.commonAncestorContainer)) {
      setPopover(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    const containerRect = articleRef.current.getBoundingClientRect();
    setPopover({ x: rect.left - containerRect.left + rect.width / 2, y: rect.top - containerRect.top, text });
  };

  const highlightQuotes = (link.highlights ?? []).map((h) => h.quote);
  const alsoInLibrary = links
    .filter((l) => l.id !== link.id && l.collectionId === link.collectionId && !l.archived)
    .slice(0, 3);

  const paragraphs = readableParagraphs(link.articleText, link.excerpt);

  const pro = isPro(plan);
  const t: TemplateData = link.templateData ?? {};
  const article = pro && link.contentType === "article";
  const published = t.publishedAt ? new Date(t.publishedAt).toLocaleDateString(undefined, { dateStyle: "medium" }) : "";
  const byline = article ? [t.author && `By ${t.author}`, published].filter(Boolean).join(" · ") : "";
  // With less than real prose the excerpt already is the body.
  const summary = article && hasProse(link.articleText) ? link.excerpt : "";
  const player = pro && link.contentType === "video" ? videoEmbedUrl(t) : undefined;
  const videoMeta = pro ? [t.channel, t.durationSeconds && clockLabel(t.durationSeconds)].filter(Boolean).join(" · ") : "";
  const recipe = pro && link.contentType === "recipe" && Boolean(t.ingredients?.length || t.steps?.length);
  const upsell = pro ? undefined : UPSELL[link.contentType];

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-6 px-4 py-6 sm:px-6 @3xl:flex-row @3xl:items-start">
      <article
        data-tour="reader"
        className="relative overflow-hidden rounded-[28px] @3xl:flex-1"
        style={{ background: "rgb(var(--surface-rgb) / .72)", border: "1px solid rgb(var(--rim-rgb) / .85)", backdropFilter: "blur(22px)" }}
      >
        <div className="relative h-[250px] w-full overflow-hidden bg-[#dfe2e5] dark:bg-[#26272b]">
          {link.heroImage ? (
            <Image src={link.heroImage} alt="" fill sizes="900px" className="object-cover" />
          ) : (
            <div className="absolute inset-0" style={{ background: link.tint }} />
          )}
          {/* Black, not ink: ink flips light in dark mode and the white title would vanish. */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-6">
            <span className="text-eyebrow text-white/85 [text-shadow:0_1px_3px_rgb(0_0_0/.5)]">{link.domain}</span>
            <h1 className="text-title max-w-[600px] text-[28px] text-white">{link.title}</h1>
          </div>
        </div>

        {(byline || summary) && (
          <div className="mx-auto flex max-w-[600px] flex-col gap-4 px-6 pt-8 sm:px-8">
            {byline && <p className="text-[13px] text-ink/55">{byline}</p>}
            {summary && (
              <div className="rounded-[18px] bg-ink/6 px-5 py-4">
                <span className="text-eyebrow text-ink/40">Summary</span>
                <p className="mt-1.5 text-[15px] leading-[1.55] text-ink/80">{summary}</p>
              </div>
            )}
          </div>
        )}

        <div
          ref={articleRef}
          data-tour="article"
          onMouseUp={handleMouseUp}
          className="relative mx-auto max-w-[600px] px-6 py-8 text-[17px] leading-[1.65] text-ink/80 sm:px-8"
        >
          {link.contentType === "video" ? (
            <>
              {player ? (
                // Privacy-enhanced players (videoEmbedUrl); the referrer is what YouTube checks embeds by.
                <iframe
                  src={player}
                  title={link.title}
                  loading="lazy"
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  className="aspect-video w-full rounded-[18px] bg-black"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 rounded-[18px] bg-ink/6 py-14 text-center">
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" style={{ stroke: "rgb(var(--ink-rgb) / .5)" }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 3v18l15-9L5 3z" />
                  </svg>
                  <p className="max-w-[360px] text-body text-ink/55">
                    Video — open the original to watch. AnyLink stores the description and thumbnail only.
                  </p>
                </div>
              )}
              {videoMeta && <p className="mt-3 text-[13px] text-ink/55">{videoMeta}</p>}
              {pro && link.excerpt && <p className="mt-5">{link.excerpt}</p>}
            </>
          ) : recipe ? (
            <RecipeCard data={t} />
          ) : (
            paragraphs.map((p, i) => (
              <p key={i} className="mb-5">
                {withHighlights(p, highlightQuotes)}
              </p>
            ))
          )}

          {upsell && (
            <button
              type="button"
              onClick={openPro}
              className="mt-6 w-full rounded-[14px] bg-ink/6 px-4 py-3 text-left text-[13px] leading-[1.5] text-ink/60"
            >
              {upsell}
            </button>
          )}

          {popover && (
            <button
              type="button"
              onClick={() => {
                addHighlight(link.id, popover.text);
                setPopover(null);
                window.getSelection()?.removeAllRanges();
              }}
              style={{ left: popover.x, top: popover.y - 42, transform: "translateX(-50%)" }}
              className="absolute z-10 flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[11.5px] font-semibold text-on-ink shadow-lg"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-lime" /> Highlight
            </button>
          )}
        </div>
      </article>

      <aside className="flex w-full flex-none flex-col gap-4 @3xl:w-[320px]">
        <RailSection title="Saved metadata">
          <RailRow label="Domain" value={link.domain} />
          <RailRow label="Saved" value={new Date(link.createdAt).toLocaleDateString()} />
          {link.readingTimeMinutes && <RailRow label="Reading time" value={`${link.readingTimeMinutes} min`} />}
        </RailSection>

        <RailSection title="Tags">
          <div className="flex flex-wrap gap-1.5">
            {link.tags.map((t) => (
              <Chip key={t} className="cursor-default">
                {t}
              </Chip>
            ))}
            {link.tags.length === 0 && <span className="text-body text-ink/40">No tags yet.</span>}
          </div>
        </RailSection>

        <RailSection title="Also in your library" action={<button onClick={onOpenCollection} className="text-[11.5px] font-semibold text-ink/50 hover:text-ink">See all</button>}>
          <div className="flex flex-col gap-2">
            {alsoInLibrary.length === 0 && <span className="text-body text-ink/40">Nothing else here yet.</span>}
            {alsoInLibrary.map((l) => (
              <Link
                key={l.id}
                href={`/links/${l.id}`}
                className="flex items-center gap-2.5 rounded-[12px] px-2 py-1.5 hover:bg-ink/6"
              >
                <span
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] text-[10px] font-bold"
                  style={{ color: l.stripe, background: l.tint }}
                >
                  {l.initial}
                </span>
                <span className="truncate text-body text-ink/75">{l.title}</span>
              </Link>
            ))}
          </div>
        </RailSection>
      </aside>
    </div>
  );
}

/** Pro's recipe template: the times, a checklist of ingredients and the numbered steps. Ticks aren't saved. */
function RecipeCard({ data }: { data: TemplateData }) {
  const [ticked, setTicked] = useState<number[]>([]);
  const times = [
    data.prepMinutes && `Prep ${minutesLabel(data.prepMinutes)}`,
    data.cookMinutes && `Cook ${minutesLabel(data.cookMinutes)}`,
    data.totalMinutes && `Total ${minutesLabel(data.totalMinutes)}`,
    data.yield && `Makes ${data.yield}`,
  ].filter((time): time is string => Boolean(time));
  const toggle = (i: number) => setTicked((list) => (list.includes(i) ? list.filter((x) => x !== i) : [...list, i]));

  return (
    <div className="flex flex-col gap-7">
      {times.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {times.map((time) => (
            <span key={time} className="rounded-full bg-ink/6 px-3 py-1.5 text-[12px] font-medium text-ink">
              {time}
            </span>
          ))}
        </div>
      )}
      {data.ingredients?.length ? (
        <section>
          <h2 className="mb-2 text-[15px] font-semibold text-ink">Ingredients</h2>
          <ul>
            {data.ingredients.map((item, i) => (
              <li key={i}>
                <label className="flex cursor-pointer items-baseline gap-3 py-1.5">
                  <input type="checkbox" checked={ticked.includes(i)} onChange={() => toggle(i)} className="h-4 w-4 flex-none translate-y-0.5 accent-lime" />
                  <span className={ticked.includes(i) ? "text-ink/40 line-through" : undefined}>{item}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {data.steps?.length ? (
        <section>
          <h2 className="mb-2 text-[15px] font-semibold text-ink">Steps</h2>
          <ol className="flex list-decimal flex-col gap-3 pl-6 marker:font-semibold marker:text-ink/50">
            {data.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

function RailSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-2.5 rounded-[22px] p-4"
      style={{ background: "rgb(var(--surface-rgb) / .55)", border: "1px solid rgb(var(--rim-rgb) / .8)", backdropFilter: "blur(20px) saturate(1.4)" }}
    >
      <div className="flex items-center">
        <span className="text-eyebrow text-ink/40">{title}</span>
        {action && <span className="ml-auto">{action}</span>}
      </div>
      {children}
    </div>
  );
}

function RailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-ink/50">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}
