import Link from "next/link";
import { AmbientOrbs } from "@/components/ambient-orbs";

/** Public landing page. Static on purpose — no library data, nothing to log in for. */

export const metadata = {
  title: "AnyLink — paste anything, we read the rest",
  description:
    "A personal library for saved links: crawled, tagged, and filed into collections you actually browse.",
};

const FEATURES = [
  {
    accent: "var(--signal-orange)",
    title: "Paste a link, get a card",
    body: "We fetch the page, pull the title, image, price or read time, and file it. Blocked pages get a fallback read instead of a dead row.",
  },
  {
    accent: "var(--lime)",
    title: "Collections that group themselves",
    body: "Links land in collections by what they actually are — things to buy, things to read, things to try — not by the folder you forgot to pick.",
  },
  {
    accent: "var(--periwinkle)",
    title: "One query language",
    body: "Every filter, saved search and sidebar item is the same `?q=` syntax. Learn it once, use it everywhere, save the ones you repeat.",
  },
  {
    accent: "var(--slate)",
    title: "Nothing rots quietly",
    body: "Link health runs in the background. Dead URLs get flagged, the inbox keeps the unsorted pile visible, trash keeps your mistakes recoverable.",
  },
];

const STEPS = [
  { n: "01", title: "Import", body: "Drop in your browser bookmarks export or your Telegram saved messages." },
  { n: "02", title: "Clean", body: "We sweep the dead links and show you exactly what's about to be dropped." },
  { n: "03", title: "Browse", body: "What's left comes back grouped, tagged and searchable in one mosaic." },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">
      <AmbientOrbs variant="library" />

      <div className="relative mx-auto w-full max-w-[1100px] px-4 sm:px-6">
        <header className="flex items-center justify-between py-6">
          <span className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-kbd)] bg-ink text-[11px] font-bold text-light-100">
              A
            </span>
            <span className="text-wordmark">AnyLink</span>
          </span>
          <Link
            href="/"
            className="flex h-9 items-center rounded-full bg-ink px-4 text-body font-semibold text-light-100"
          >
            Open library
          </Link>
        </header>

        {/* Hero */}
        <section className="flex flex-col items-center gap-6 pt-14 pb-16 text-center sm:pt-24">
          <span className="rounded-full bg-white/70 px-4 py-2 text-eyebrow text-ink/50">
            Your saved links, finally readable
          </span>
          <h1 className="text-display max-w-[760px] text-[40px] sm:text-[56px]">
            Paste anything. We read the rest.
          </h1>
          <p className="max-w-[500px] text-lead text-ink/55">
            A personal library for the links you keep meaning to get back to — crawled, tagged,
            and filed into collections you actually browse.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <Link
              href="/start"
              className="flex h-12 items-center rounded-full bg-ink px-7 text-body font-semibold text-light-100 shadow-card"
            >
              Import my links
            </Link>
            <Link
              href="/"
              className="glass-55 flex h-12 items-center rounded-full px-7 text-body font-semibold text-ink/70"
            >
              See the library
            </Link>
          </div>
        </section>

        {/* Product frame */}
        <section className="glass-42 rounded-panel p-3 shadow-window">
          <div className="flex flex-col gap-3 rounded-card bg-paper/80 p-5">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-signal" />
              <span className="h-2.5 w-2.5 rounded-full bg-lime" />
              <span className="h-2.5 w-2.5 rounded-full bg-periwinkle" />
              <span className="ml-2 text-meta text-ink/40">anylink — all links</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {["Read later", "To buy", "Tools", "Recipes"].map((label, i) => (
                <div key={label} className="flex flex-col gap-2.5 rounded-card bg-ink/6 p-3.5">
                  <div
                    className="h-16 rounded-[var(--radius-nav)]"
                    style={{
                      background: [
                        "var(--signal-orange)",
                        "var(--lime)",
                        "var(--periwinkle)",
                        "var(--slate)",
                      ][i],
                      opacity: 0.85,
                    }}
                  />
                  <span className="text-body">{label}</span>
                  <span className="text-meta text-ink/45">{[12, 7, 23, 5][i]} links</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="grid gap-3 pt-16 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="glass-55 flex flex-col gap-2.5 rounded-card p-6">
              <span
                className="h-7 w-7 rounded-[var(--radius-badge)]"
                style={{ background: f.accent }}
              />
              <h2 className="text-title">{f.title}</h2>
              <p className="text-lead text-ink/55">{f.body}</p>
            </div>
          ))}
        </section>

        {/* How it works */}
        <section className="pt-16">
          <h2 className="text-hero text-[32px] sm:text-[40px]">From a pile to a library</h2>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="flex flex-col gap-2 rounded-card bg-paper p-6 shadow-card">
                <span className="text-eyebrow text-ink/40">{s.n}</span>
                <span className="text-title">{s.title}</span>
                <p className="text-lead text-ink/55">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mt-16 flex flex-col items-start gap-4 rounded-panel bg-doc-shell p-9 shadow-window sm:p-12">
          <h2 className="text-hero max-w-[520px] text-[32px] text-light-100 sm:text-[44px]">
            Your bookmarks bar is a graveyard.
          </h2>
          <p className="max-w-[440px] text-lead text-light-55">
            Import it once. Dead links get stripped, the rest come back grouped by what you
            actually care about.
          </p>
          <Link
            href="/start"
            className="mt-1 flex h-12 items-center rounded-full bg-lime px-7 text-body font-semibold text-ink"
          >
            Import my links
          </Link>
        </section>

        <footer className="flex items-center justify-between py-8 text-meta text-ink/45">
          <span>AnyLink</span>
          <Link href="/">Open library</Link>
        </footer>
      </div>
    </div>
  );
}
