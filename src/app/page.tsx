import Image from "next/image";
import Link from "next/link";
import { AmbientOrbs } from "@/components/ambient-orbs";
import { ThemeToggle } from "@/components/theme-toggle";
import { MessPile, Scribble } from "@/components/mess-pile";
import { AppDemo } from "@/components/app-demo";
import { UrlPreview } from "@/components/url-preview";
import { SearchDemo } from "@/components/search-demo";
import { PlayOnView } from "@/components/play-on-view";
import { Icon } from "@/components/icon";
import { TourButton } from "@/components/tour";

/** Public landing page. Static on purpose — no library data, nothing to log in for. */

export const metadata = {
  title: "AnyLink — paste anything, we read the rest",
  description:
    "A personal library for saved links: crawled, tagged, and filed into collections you actually browse.",
};

// ponytail: anchors for sections still to come — add ids as those sections land.
const NAV = [
  { label: "Features", href: "#features" },
  { label: "Templates", href: "#templates" },
  { label: "Integrations", href: "#integrations" },
  { label: "Pricing", href: "#pricing" },
];

// Photos: Unsplash.
const COLLECTIONS = [
  { name: "Reading", count: 12, color: "var(--signal-orange)", image: "/images/collections/reading.webp" },
  { name: "Inspiration", count: 24, color: "var(--lime)", image: "/images/collections/inspiration.webp" },
  { name: "Shopping", count: 16, color: "var(--periwinkle)", image: "/images/collections/shopping.webp" },
  { name: "Everything else", count: 20, color: "var(--slate)", image: "/images/collections/everything.webp" },
];

const STEPS = [
  {
    n: "01",
    title: "Save",
    accent: "var(--signal-orange)",
    body: "Paste any link, or import your browser bookmarks and Telegram saved messages in one go.",
    details: ["Title, image, price and read time pulled for you", "Blocked pages get a fallback read, not a dead row"],
  },
  {
    n: "02",
    title: "Organise",
    accent: "var(--lime)",
    body: "Links land in collections by what they actually are — things to buy, to read, to try.",
    details: ["Dead links flagged before they pile up", "Trash keeps your mistakes recoverable"],
  },
  {
    n: "03",
    title: "Find",
    accent: "var(--periwinkle)",
    body: "One query language behind search, filters and saved views. Learn it once, use it everywhere.",
    details: ["Searches the page text, not just titles", "Save the searches you repeat as smart collections"],
  },
];

// ponytail: user count is hand-set — keep it honest as the library grows.
const STATS = [
  { value: "1K+", label: "happy users" },
  { value: "1", label: "search for everything" },
  { value: "100%", label: "private by default" },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">
      <AmbientOrbs variant="library" />

      <div className="relative mx-auto w-full max-w-[1240px] px-4 sm:px-6">
        <header className="relative z-[110] flex items-center justify-between gap-6 py-6">
          <div className="flex items-center gap-10">
            <span className="text-wordmark">AnyLink</span>
            <nav className="hidden items-center gap-7 text-body text-ink/60 md:flex">
              {NAV.map((n) => (
                <a key={n.href} href={n.href} className="hover:text-ink">
                  {n.label}
                </a>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Link
              href="/app"
              className="flex h-9 items-center rounded-full bg-ink px-4 text-body font-semibold text-on-ink"
            >
              Get started
            </Link>
          </div>
        </header>

        {/* Hero */}
        <section className="relative grid grid-cols-[minmax(0,1fr)] items-center gap-6 pt-8 pb-12 md:grid-cols-[0.9fr_minmax(0,1.1fr)] md:gap-10 md:pt-12 md:pb-24">
          <div className="relative z-10 flex flex-col items-center gap-6 text-center md:items-start md:text-left">
            <span className="rounded-full bg-surface/70 px-4 py-2 text-eyebrow text-ink/50">
              Your saved links, finally readable
            </span>
            <h1 className="text-display max-w-[560px] text-[46px] leading-[0.95] sm:text-[64px] lg:text-[84px]">
              The internet <br className="hidden sm:block" />is a beautiful mess.
            </h1>
            <p className="max-w-[440px] text-[17px] leading-[1.5] text-ink/55">
              Save anything — articles, products, videos, places. AnyLink turns chaotic bookmarks
              into a clean, visual library you’ll actually browse.
            </p>
            <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
              <Link
                href="/start"
                className="flex h-12 items-center justify-center rounded-full bg-ink px-7 text-body font-semibold text-on-ink shadow-card"
              >
                Get started
              </Link>
              {/* Starts the app's guided tour; it navigates to /app itself. */}
              <TourButton className="flex h-12 items-center justify-center rounded-full bg-surface/80 px-7 text-body font-semibold shadow-card">
                See how it works
              </TourButton>
            </div>
          </div>

          <MessPile />

          <Scribble className="absolute bottom-0 left-0 hidden -rotate-6 md:flex">
            …TO THIS
            <svg viewBox="0 0 80 60" className="-mt-1 ml-24 h-14 w-20" aria-hidden>
              <path d="M4 8c30-6 48 8 44 44M48 52l-10-8M48 52l6-11" />
            </svg>
          </Scribble>
        </section>

        {/* Product demo — the real mosaic on local-only data */}
        <section>
          <AppDemo />
        </section>

        <UrlPreview />

        {/* Collections */}
        <section className="pt-16 md:pt-24">
          <h2 className="text-display text-[40px] leading-[0.98] sm:text-[56px]">
            A place for every rabbit hole.
          </h2>
          <p className="mt-4 max-w-[480px] text-[17px] leading-[1.5] text-ink/55">
            Keep your links in collections by what they actually are — not just another folder.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {COLLECTIONS.map((c) => (
              <div key={c.name} className="group flex flex-col gap-4 rounded-panel bg-paper p-3 shadow-card sm:p-4">
                <div className="flex items-start gap-3 px-1 pt-1">
                  <span className="mt-0.5 h-7 w-7 flex-none rounded-[9px]" style={{ background: c.color }} />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-[16px] leading-tight font-semibold tracking-[-0.02em]">{c.name}</span>
                    <span className="text-meta text-ink/45">{c.count} links</span>
                  </div>
                </div>
                <div className="relative aspect-[5/4] overflow-hidden rounded-card">
                  <Image
                    src={c.image}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 280px, 45vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <SearchDemo />

        {/* How it works */}
        <section id="how-it-works" className="pt-16 md:pt-24">
          <h2 className="text-display text-[40px] leading-[0.98] sm:text-[56px]">
            From a pile
            <br />
            to a library.
          </h2>
          <p className="mt-4 max-w-[480px] text-[17px] leading-[1.5] text-ink/55">
            Three steps, no filing required. AnyLink does the sorting so you can get back to the good stuff.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="flex flex-col gap-3 rounded-panel bg-paper p-6 shadow-card sm:p-7">
                <div className="flex items-center justify-between">
                  <span className="h-8 w-8 rounded-[10px]" style={{ background: s.accent }} />
                  <span className="text-eyebrow text-ink/35">{s.n}</span>
                </div>
                <h3 className="mt-2 text-title">{s.title}</h3>
                <p className="text-lead text-ink/60">{s.body}</p>
                <ul className="mt-auto flex flex-col gap-2 border-t border-ink/8 pt-4">
                  {s.details.map((d) => (
                    <li key={d} className="flex items-start gap-2 text-body text-ink/65">
                      <Icon name="check" size={12} className="mt-1 text-ink/40" />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Closing CTA */}
        <footer className="relative grid grid-cols-[minmax(0,1fr)] items-center gap-6 pt-20 pb-12 md:grid-cols-[1.1fr_minmax(0,1fr)] md:pt-32 md:pb-16">
          <div className="relative z-10 flex flex-col gap-6">
            <h2 className="text-display text-[40px] leading-[0.98] sm:text-[56px]">
              Everything worth
              <br />
              keeping. In one place.
            </h2>
            <p className="max-w-[440px] text-[17px] leading-[1.5] text-ink/55">
              Save, organise and rediscover your favourite links — whenever inspiration strikes.
            </p>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Link
                href="/start"
                className="flex h-12 items-center justify-center rounded-full bg-ink px-7 text-body font-semibold text-on-ink shadow-card"
              >
                Get started for free
              </Link>
              <Link
                href="/app"
                className="flex h-12 items-center justify-center rounded-full bg-surface/80 px-7 text-body font-semibold shadow-card"
              >
                Open my library
              </Link>
            </div>
            <dl className="mt-6 grid max-w-[520px] grid-cols-3 gap-6">
              {STATS.map((s) => (
                <div key={s.label} className="flex flex-col gap-1">
                  <dt className="text-[26px] font-semibold tracking-[-0.03em]">{s.value}</dt>
                  <dd className="text-meta text-ink/50">{s.label}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="relative">
            <PlayOnView
              src="/videos/chain_transparent.webm"
              poster="/videos/chain_last.webp"
              aria-hidden
              className="pointer-events-none -mx-[15%] w-[130%] max-w-none -rotate-10 md:mx-0 md:-ml-[12%] md:w-[135%]"
            />
            <Scribble className="absolute right-0 bottom-[8%] hidden rotate-6 lg:flex">
              SAME
              <br />
              IDEAS.
              <br />
              LESS
              <br />
              CHAOS.
              <svg viewBox="0 0 80 40" className="-mt-2 -ml-24 h-10 w-20" aria-hidden>
                <path d="M76 16C58 30 30 32 6 22M6 22l11-7M6 22l9 9" />
              </svg>
            </Scribble>
          </div>
        </footer>
      </div>
    </div>
  );
}
