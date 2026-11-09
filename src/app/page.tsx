import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";
import { Caveat, Instrument_Serif } from "next/font/google";
import "./landing.css";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSelect } from "@/components/language-select";
import { AppDemo } from "@/components/app-demo";
import { UrlPreview } from "@/components/url-preview";
import { SearchDemo } from "@/components/search-demo";
import { PhoneArc } from "@/components/landing-phones";
import { TiltSection } from "@/components/tilt-section";
import { TourButton } from "@/components/tour";
import { APP_STORE_URL, PRO_BENEFITS } from "@/lib/pro";
import { linkCount } from "@/lib/format";
import { getLocale, getT } from "@/i18n/server";
import { msg } from "@/i18n/translate";
import appIcon from "../../public/images/landing/app-icon.webp";
import chain from "../../public/images/landing/chain.webp";
import plant from "../../public/images/hero/plant.webp";
import house from "../../public/images/hero/house.webp";
import heroVilla from "../../public/images/hero/villa.webp";
import heroBook from "../../public/images/hero/book.webp";
import heroSneaker from "../../public/images/hero/sneaker.webp";
import heroCamera from "../../public/images/hero/camera.webp";
import maps from "../../public/images/hero/maps.webp";
import pasta from "../../public/images/hero/pasta.webp";
import heroBarcelona from "../../public/images/hero/barcelona.webp";
import apartamento from "../../public/images/hero/apartamento.webp";
import coffee from "../../public/images/demo/coffee.webp";
import book from "../../public/images/demo/book.webp";
import office from "../../public/images/demo/office.webp";
import tokyo from "../../public/images/demo/tokyo.webp";
import sneakers from "../../public/images/demo/sneakers.webp";
import kyoto from "../../public/images/demo/kyoto.webp";
import bcnGuell from "../../public/images/demo/bcn-guell.webp";
import colReading from "../../public/images/collections/reading.webp";
import colInspiration from "../../public/images/collections/inspiration.webp";
import colShopping from "../../public/images/collections/shopping.webp";
import colEverything from "../../public/images/collections/everything.webp";

/** Public landing page. Static on purpose — no library data, nothing to log in for.
 *  Styles: ./landing.css, ported from design/AnyLink — landing-html. */

export async function generateMetadata() {
  const t = await getT();
  return {
    title: t("AnyLink — paste anything, we read the rest"),
    description: t("A personal library for saved links: crawled, tagged, and filed into collections you actually browse."),
  };
}

const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument-serif" });
const hand = Caveat({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-caveat" });

/** Pricing sells Pro, so production shows it only once the App Store listing exists. Development always shows it, as a
 * preview. */
const SHOW_PRICING = APP_STORE_URL !== null || process.env.NODE_ENV !== "production";

const NAV = [
  { label: msg("Features"), href: "#features" },
  { label: msg("Collections"), href: "#collections" },
  { label: msg("Search"), href: "#search" },
  { label: "iPhone", href: "#iphone" },
  { label: msg("How it works"), href: "#how-it-works" },
  ...(SHOW_PRICING ? [{ label: msg("Pricing"), href: "#pricing" }] : []),
];

// Back to front. z/rotations place each tile in the 3D pile; --sx/--sy is where the
// scroll-driven "suck" animation pulls it (down into the app window).
const TILES = [
  { img: plant, far: true, left: 36, top: 73, width: 24, t: "translateZ(-300px) rotateZ(12deg) rotateY(-20deg)", f: "7.4s", dl: "-1s", sx: -120, sy: 520 },
  { img: house, far: true, left: 62, top: 27, width: 32, t: "translateZ(-220px) rotateZ(7deg) rotateY(24deg) rotateX(8deg)", f: "6.6s", dl: "-3s", sx: -420, sy: 700 },
  { img: heroVilla, left: 11, top: 0, width: 27, t: "translateZ(-140px) rotateZ(-9deg) rotateY(-16deg)", f: "8s", dl: "-2s", sx: -160, sy: 820 },
  { img: heroBook, left: 22, top: 14, width: 35, t: "translateZ(-60px) rotateZ(10deg) rotateY(14deg) rotateX(-6deg)", f: "6.2s", dl: "-4s", sx: -240, sy: 760 },
  { img: heroSneaker, left: 40, top: 4, width: 41, t: "translateZ(30px) rotateZ(-8deg) rotateY(-12deg)", f: "7s", dl: "-1.5s", sx: -320, sy: 800 },
  { img: heroCamera, left: 0, top: 43, width: 34, t: "translateZ(90px) rotateZ(-10deg) rotateY(18deg)", f: "5.6s", dl: "-2.6s", sx: -60, sy: 640 },
  { img: maps, left: 60, top: 68, width: 38, t: "translateZ(60px) rotateZ(-7deg) rotateX(14deg) rotateY(-10deg)", f: "6.8s", dl: "-5s", sx: -440, sy: 520 },
  { img: pasta, left: 0, top: 61, width: 35, t: "translateZ(150px) rotateZ(-5deg) rotateY(16deg) rotateX(6deg)", f: "6s", dl: "-3.4s", sx: -40, sy: 560 },
  { img: heroBarcelona, left: 34, top: 45, width: 30, t: "translateZ(200px) rotateZ(4deg) rotateY(-14deg) rotateX(-8deg)", f: "7.8s", dl: "-.8s", sx: -260, sy: 600 },
  { img: apartamento, left: 63, top: 42, width: 36, t: "translateZ(250px) rotateZ(-4deg) rotateY(-22deg)", f: "6.4s", dl: "-2.2s", sx: -500, sy: 640 },
];

const MARQUEE: [string, "" | "s" | "f"][] = [
  [msg("Articles"), ""], [msg("videos"), "s"], [msg("Products"), "f"], [msg("Places"), ""],
  [msg("recipes"), "s"], [msg("Posts"), "f"], [msg("Notes"), ""], [msg("images"), "s"],
];

// Photos: Unsplash. `back` is the two cards fanned out behind, farthest first.
const DECKS = [
  { name: msg("Reading"), count: 12, color: "#ff5a1f", img: colReading, alt: msg("A stack of books under a cup"), back: [coffee, book] },
  { name: msg("Inspiration"), count: 24, color: "#d6f24b", img: colInspiration, alt: msg("Palm leaves against a warm wall"), back: [office, tokyo] },
  { name: msg("Shopping"), count: 16, color: "#7c8cff", img: colShopping, alt: msg("Sneakers on a chair"), back: [heroCamera, sneakers], cutout: true },
  { name: msg("Everything else"), count: 20, color: "#9aa3ad", img: colEverything, alt: msg("A film camera on a map"), back: [kyoto, bcnGuell] },
];

const STEPS = [
  {
    n: "01",
    title: msg("Save"),
    color: "#ff5a1f",
    body: msg("Paste any link, or import your browser bookmarks and Telegram saved messages in one go."),
    details: [msg("Title, image, price and read time pulled for you"), msg("Blocked pages get a fallback read, not a dead row")],
  },
  {
    n: "02",
    title: msg("Organise"),
    color: "#d6f24b",
    body: msg("Links land in collections by what they actually are — things to buy, to read, to try."),
    details: [msg("Dead links flagged before they pile up"), msg("Trash keeps your mistakes recoverable")],
  },
  {
    n: "03",
    title: msg("Find"),
    color: "#7c8cff",
    body: msg("One query language behind search, filters and saved views. Learn it once, use it everywhere."),
    details: [msg("Searches the page text, not just titles"), msg("Save the searches you repeat as smart collections")],
  },
];

// The Free column of "What ships" in docs/pro-build-plan.md. Pro's column is PRO_BENEFITS, the paywall's list.
const FREE = [
  msg("A library on your iPhone, synced with iCloud"),
  msg("Or a library on the web, with a free account"),
  msg("Collections, tags, notes, images and highlights"),
  msg("Reader view, search and smart collections"),
  msg("Import your bookmarks, grouped by AI"),
  msg("Share sheet, widgets, Shortcuts and Spotlight"),
  msg("Save from Chrome, with a web account"),
  msg("Title, image and reading time on every save"),
];

// ponytail: user count is hand-set — keep it honest as the library grows.
const STATS = [
  { value: "1K+", label: msg("happy users") },
  { value: "1", label: msg("search for everything") },
  { value: "100%", label: msg("private by default") },
];

const ARROW = (
  <svg className="ic" viewBox="0 0 24 24" aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
const CHECK = (
  <svg className="ic" viewBox="0 0 24 24" aria-hidden>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
const PHONE = (
  <svg className="ic" viewBox="0 0 24 24" aria-hidden>
    <rect x="6.5" y="2.5" width="11" height="19" rx="3" />
    <path d="M10.5 18.5h3" />
  </svg>
);
const GLOBE = (
  <svg className="ic" viewBox="0 0 24 24" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
  </svg>
);
const STAR = (
  <svg className="mq-star ic fill" viewBox="0 0 24 24">
    <path d="M12 2.5l2 6.5 6.5 2-6.5 2-2 6.5-2-6.5-6.5-2 6.5-2z" />
  </svg>
);

function Brand(props: React.ComponentProps<"a">) {
  return (
    <a className="brand" href="#top" {...props}>
      <Image src={appIcon} alt="" sizes="32px" />
      <span>AnyLink</span>
    </a>
  );
}

export default async function LandingPage() {
  const t = await getT();
  const locale = await getLocale();
  return (
    <div className={`al ${serif.variable} ${hand.variable}`}>
      <header className="nav">
        <div className="nav-in">
          <Brand aria-label={t("AnyLink home")} />
          <nav className="nav-links" aria-label={t("Sections")}>
            {NAV.map((n) => (
              <a key={n.href} href={n.href}>
                {t(n.label)}
              </a>
            ))}
          </nav>
          <div className="nav-cta">
            {/* The native select sits invisibly over the globe, so the picker is the platform's own. */}
            <label className="lang">
              {GLOBE}
              <span>{locale.split("-")[0].toUpperCase()}</span>
              <LanguageSelect />
            </label>
            <ThemeToggle />
            <Link className="signin" href="/login">
              {t("Sign in")}
            </Link>
            <Link className="btn btn-acc" href="/start">
              {t("Get started")}
            </Link>
          </div>
        </div>
      </header>

      <TiltSection className="hero" id="top">
        <div className="scene">
          <div className="flare flare-glow hero-glow" aria-hidden />
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <span className="eyebrow">
                <span className="dot" />
                {t("Your saved links, finally readable")}
              </span>
              <h1 className="h1">
                {t("The internet")}
                <br />
                {t("is a")} <span className="it">{t("beautiful")}</span>
                <br />
                <span className="it">{t("mess.")}</span>
              </h1>
              <p className="lead">
                {t(
                  "Save anything — articles, products, videos, places. AnyLink turns chaotic bookmarks into a clean, visual library you’ll actually browse.",
                )}
              </p>
              <div className="btns">
                <Link className="btn btn-acc" href="/start">
                  {t("Get started")} {ARROW}
                </Link>
                {/* Starts the app's guided tour; it navigates to /app itself. */}
                <TourButton className="btn btn-glass">{t("See how it works")}</TourButton>
              </div>
            </div>
            <div className="pile-wrap" aria-hidden>
              {TILES.map((tile) => (
                <div
                  key={tile.img.src}
                  className={tile.far ? "tile far" : "tile"}
                  style={{
                    left: `${tile.left}%`,
                    top: `${tile.top}%`,
                    width: `${tile.width}%`,
                    transform: tile.t,
                    ...({ "--f": tile.f, "--dl": tile.dl, "--sx": `${tile.sx}px`, "--sy": `${tile.sy}px` } as React.CSSProperties),
                  }}
                >
                  <Image src={tile.img} alt="" loading="eager" sizes="(max-width: 760px) 40vw, 300px" />
                </div>
              ))}
              <div className="scribble sc-from">
                {t("FROM")}
                <br />
                {t("THIS…")}
                <svg viewBox="0 0 80 70" style={{ width: 80, height: 64, marginLeft: -56 }} aria-hidden>
                  <path d="M60 4C66 30 44 52 14 58M14 58l10-8M14 58l11 6" />
                </svg>
              </div>
            </div>
          </div>
          <div className="scribble sc-to" aria-hidden>
            {t("…TO THIS")}
            <svg viewBox="0 0 80 60" style={{ width: 80, height: 56, margin: "-4px 0 0 96px" }} aria-hidden>
              <path d="M4 8c30-6 48 8 44 44M48 52l-10-8M48 52l6-11" />
            </svg>
          </div>
        </div>
      </TiltSection>

      <section className="app" id="app" aria-label={t("Your library, live")}>
        <div className="horizon" aria-hidden />
        <div className="wrap">
          <div className="win-stage">
            <div className="scribble sc-try" aria-hidden>
              {t("HOVER A CARD —")}<br />
              {t("RESIZE, PIN, BIN IT")}
            </div>
            <div className="win-fly">
              <div className="win-rig">
                {Array.from({ length: 8 }, (_, i) => (
                  <i key={i} className="win-edge" />
                ))}
                <AppDemo />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="marq" aria-hidden>
        <div className="marq-track">
          {[0, 1].map((set) => (
            <div key={set} className="marq-set">
              {MARQUEE.map(([word, style]) => (
                <Fragment key={word}>
                  <span className={`mq ${style}`}>{t(word)}</span>
                  {STAR}
                </Fragment>
              ))}
            </div>
          ))}
        </div>
      </div>

      <UrlPreview />

      <section className="sec" id="collections">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">
              <span className="dot" />
              {t("Collections")}
            </span>
            <h2 className="h2">
              {t("A place for every")}
              <br />
              <span className="it">{t("rabbit hole.")}</span>
            </h2>
            <p className="lead">{t("Keep your links in collections by what they actually are — not just another folder.")}</p>
          </div>
          <div className="decks">
            {DECKS.map((d) => (
              <div key={d.name} className="deck">
                <div className="deck-3d" style={{ "--c": d.color } as React.CSSProperties}>
                  {d.back.map((img, i) => (
                    <div key={i} className={`dk dk-b ${i === 0 ? "dk-b2" : "dk-b1"} ${i === 0 && d.cutout ? "dk-cut" : ""}`}>
                      <Image src={img} alt="" sizes="(max-width: 760px) 50vw, 300px" />
                    </div>
                  ))}
                  <div className="dk dk-f">
                    <div className="dk-head">
                      <span className="dk-mark" style={{ background: d.color }} />
                      <div className="dk-name">
                        <b>{t(d.name)}</b>
                        <span>{linkCount(d.count, t)}</span>
                      </div>
                    </div>
                    <div className="dk-img">
                      <Image src={d.img} alt={t(d.alt)} sizes="(max-width: 760px) 50vw, 300px" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SearchDemo />

      <section className="iph" id="iphone">
        <div className="flare flare-glow iph-glow" aria-hidden />
        <div className="wrap iph-head">
          <div className="sec-head">
            <span className="eyebrow">
              <span className="dot" />
              {t("AnyLink for iPhone")}
            </span>
            <h2 className="h2">
              {t("Save from any app")}
              <br />
              <span className="it">{t("in one tap.")}</span>
            </h2>
          </div>
          <div className="sec-head" style={{ gap: 26 }}>
            <p className="lead">
              {t(
                "Share to AnyLink from anywhere and it’s filed before the sheet closes. Clear Unsorted with a swipe, read without the clutter, and share a whole collection with one link.",
              )}
            </p>
            <div className="btns">
              <a className="btn btn-glass" href={APP_STORE_URL ?? "#iphone"}>
                {PHONE}
                {t("Get the iPhone app")}
              </a>
            </div>
          </div>
        </div>
        <PhoneArc />
      </section>

      <section className="how" id="how-it-works">
        <div className="band">
          <div className="wrap">
            <div className="sec-head">
              <span className="eyebrow">
                <span className="dot" />
                {t("How it works")}
              </span>
              <h2 className="h2">
                {t("From a pile")}
                <br />
                {t("to a library.")}
              </h2>
              <p className="lead">
                {t("Three steps, no filing required. AnyLink does the sorting so you can get back to the good stuff.")}
              </p>
            </div>
            <div className="steps">
              {STEPS.map((s, i) => (
                <article key={s.n} className={`step step-${"abc"[i]}`} style={{ "--c": s.color } as React.CSSProperties}>
                  <div className="step-top">
                    <div className="cube-wrap" aria-hidden>
                      <div className="cube" style={{ animationDelay: `${-6 * i}s` }}>
                        {Array.from({ length: 6 }, (_, f) => (
                          <i key={f} />
                        ))}
                      </div>
                    </div>
                    <span className="step-n">{s.n}</span>
                  </div>
                  <h3>{t(s.title)}</h3>
                  <p>{t(s.body)}</p>
                  <ul>
                    {s.details.map((d) => (
                      <li key={d}>
                        {CHECK}
                        {t(d)}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {SHOW_PRICING && (
        <section className="sec" id="pricing">
          <div className="wrap">
            <div className="sec-head">
              <span className="eyebrow">
                <span className="dot" />
                {t("Pricing")}
              </span>
              <h2 className="h2">
                {t("Free to use.")}
                <br />
                <span className="it">{t("Pro when you want more.")}</span>
              </h2>
              <p className="lead">
                {t(
                  "AnyLink is free on your iPhone and on the web. Pro joins the two into one library, and reads every page more closely.",
                )}
              </p>
            </div>
            <div className="plans">
              <article className="plan">
                <h3>{t("Free")}</h3>
                <p className="plan-price">
                  <b>$0</b>
                </p>
                <p className="plan-sub">{t("No account needed on iPhone.")}</p>
                <p className="plan-eb">{t("Included")}</p>
                <ul>
                  {FREE.map((f) => (
                    <li key={f}>
                      {CHECK}
                      {t(f)}
                    </li>
                  ))}
                </ul>
              </article>
              <article className="plan plan-pro">
                <h3>Pro</h3>
                <p className="plan-price">
                  <b>$2.99</b> {t("a month")}
                </p>
                <p className="plan-sub">{t("or {yearly} a year · {lifetime} lifetime", { yearly: "$19.99", lifetime: "$49.99" })}</p>
                <p className="plan-eb">{t("Everything in Free, plus")}</p>
                <ul>
                  {PRO_BENEFITS.map((b) => (
                    <li key={b}>
                      {CHECK}
                      {t(b)}
                    </li>
                  ))}
                </ul>
              </article>
            </div>
            <div className="plans-foot">
              <p>
                {t(
                  "Pro is bought in the AnyLink iPhone app, and works on the web with the same account. Lifetime includes about 1,000 AI saves a month.",
                )}
              </p>
              {APP_STORE_URL ? (
                <a className="btn btn-acc" href={APP_STORE_URL}>
                  {PHONE}
                  {t("Get AnyLink on the App Store")}
                </a>
              ) : (
                <p>{t("AnyLink for iPhone is coming to the App Store.")}</p>
              )}
            </div>
          </div>
        </section>
      )}

      <TiltSection className="cta">
        <div className="wrap cta-grid">
          <div className="cta-copy">
            <h2 className="h2">
              {t("Everything worth")}
              <br />
              {t("keeping.")} <span className="it">{t("In one place.")}</span>
            </h2>
            <p className="lead">{t("Save, organise and rediscover your favourite links — whenever inspiration strikes.")}</p>
            <div className="btns">
              <Link className="btn btn-acc" href="/start">
                {t("Get started for free")} {ARROW}
              </Link>
              <Link className="btn btn-glass" href="/app">
                {t("Open my library")}
              </Link>
            </div>
            <dl className="stats">
              {STATS.map((s) => (
                <div key={s.label}>
                  <dt>{t(s.label)}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="chain-stage" aria-hidden>
            <div className="flare flare-glow chain-glow" />
            <div className="flare chain-glow2" />
            <div className="chain-ring" />
            <div className="chain-floor" />
            <div className="chain">
              <Image src={chain} alt="" sizes="(max-width: 760px) 300px, 560px" />
            </div>
            <div className="scribble sc-same">
              {t("SAME")}
              <br />
              {t("IDEAS.")}
              <br />
              {t("LESS")}
              <br />
              {t("CHAOS.")}
              <svg viewBox="0 0 80 40" style={{ width: 80, height: 40, margin: "-8px 0 0 -96px" }} aria-hidden>
                <path d="M76 16C58 30 30 32 6 22M6 22l11-7M6 22l9 9" />
              </svg>
            </div>
          </div>
        </div>
      </TiltSection>

      <footer className="foot">
        <div className="wrap foot-row">
          <Brand />
          <nav className="foot-links" aria-label={t("Footer")}>
            {NAV.map((n) => (
              <a key={n.href} href={n.href}>
                {t(n.label)}
              </a>
            ))}
            <Link href="/privacy-policy">{t("Privacy Policy")}</Link>
          </nav>
          <span>© {new Date().getFullYear()} AnyLink</span>
        </div>
        <div className="foot-word" aria-hidden>
          AnyLink
        </div>
      </footer>
    </div>
  );
}
