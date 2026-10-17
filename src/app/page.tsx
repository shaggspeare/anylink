import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";
import { Caveat, Instrument_Serif } from "next/font/google";
import "./landing.css";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppDemo } from "@/components/app-demo";
import { UrlPreview } from "@/components/url-preview";
import { SearchDemo } from "@/components/search-demo";
import { PhoneArc } from "@/components/landing-phones";
import { TiltSection } from "@/components/tilt-section";
import { TourButton } from "@/components/tour";
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

export const metadata = {
  title: "AnyLink — paste anything, we read the rest",
  description:
    "A personal library for saved links: crawled, tagged, and filed into collections you actually browse.",
};

const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument-serif" });
const hand = Caveat({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-caveat" });

const NAV = [
  { label: "Features", href: "#features" },
  { label: "Collections", href: "#collections" },
  { label: "Search", href: "#search" },
  { label: "iPhone", href: "#iphone" },
  { label: "How it works", href: "#how-it-works" },
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
  ["Articles", ""], ["videos", "s"], ["Products", "f"], ["Places", ""],
  ["recipes", "s"], ["Posts", "f"], ["Notes", ""], ["images", "s"],
];

// Photos: Unsplash. `back` is the two cards fanned out behind, farthest first.
const DECKS = [
  { name: "Reading", count: 12, color: "#ff5a1f", img: colReading, alt: "A stack of books under a cup", back: [coffee, book] },
  { name: "Inspiration", count: 24, color: "#d6f24b", img: colInspiration, alt: "Palm leaves against a warm wall", back: [office, tokyo] },
  { name: "Shopping", count: 16, color: "#7c8cff", img: colShopping, alt: "Sneakers on a chair", back: [heroCamera, sneakers], cutout: true },
  { name: "Everything else", count: 20, color: "#9aa3ad", img: colEverything, alt: "A film camera on a map", back: [kyoto, bcnGuell] },
];

const STEPS = [
  {
    n: "01",
    title: "Save",
    color: "#ff5a1f",
    body: "Paste any link, or import your browser bookmarks and Telegram saved messages in one go.",
    details: ["Title, image, price and read time pulled for you", "Blocked pages get a fallback read, not a dead row"],
  },
  {
    n: "02",
    title: "Organise",
    color: "#d6f24b",
    body: "Links land in collections by what they actually are — things to buy, to read, to try.",
    details: ["Dead links flagged before they pile up", "Trash keeps your mistakes recoverable"],
  },
  {
    n: "03",
    title: "Find",
    color: "#7c8cff",
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

const ARROW = (
  <svg className="ic" viewBox="0 0 24 24" aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" />
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
      AnyLink
    </a>
  );
}

export default function LandingPage() {
  return (
    <div className={`al ${serif.variable} ${hand.variable}`}>
      <header className="nav">
        <div className="nav-in">
          <Brand aria-label="AnyLink home" />
          <nav className="nav-links" aria-label="Sections">
            {NAV.map((n) => (
              <a key={n.href} href={n.href}>
                {n.label}
              </a>
            ))}
          </nav>
          <div className="nav-cta">
            <ThemeToggle />
            <Link className="signin" href="/login">
              Sign in
            </Link>
            <Link className="btn btn-acc" href="/start">
              Get started
            </Link>
          </div>
        </div>
      </header>

      <TiltSection className="hero" id="top">
        <div className="scene">
          <div className="flare flare-glow hero-glow" aria-hidden />
          <div className="flare flare-body hero-flare" aria-hidden />
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <span className="eyebrow">
                <span className="dot" />
                Your saved links, finally readable
              </span>
              <h1 className="h1">
                The internet
                <br />
                is a <span className="it">beautiful</span>
                <br />
                <span className="it">mess.</span>
              </h1>
              <p className="lead">
                Save anything — articles, products, videos, places. AnyLink turns chaotic bookmarks into a clean,
                visual library you’ll actually browse.
              </p>
              <div className="btns">
                <Link className="btn btn-acc" href="/start">
                  Get started {ARROW}
                </Link>
                {/* Starts the app's guided tour; it navigates to /app itself. */}
                <TourButton className="btn btn-glass">See how it works</TourButton>
              </div>
            </div>
            <div className="pile-wrap" aria-hidden>
              {TILES.map((t) => (
                <div
                  key={t.img.src}
                  className={t.far ? "tile far" : "tile"}
                  style={{
                    left: `${t.left}%`,
                    top: `${t.top}%`,
                    width: `${t.width}%`,
                    transform: t.t,
                    ...({ "--f": t.f, "--dl": t.dl, "--sx": `${t.sx}px`, "--sy": `${t.sy}px` } as React.CSSProperties),
                  }}
                >
                  <Image src={t.img} alt="" loading="eager" sizes="(max-width: 760px) 40vw, 300px" />
                </div>
              ))}
              <div className="scribble sc-from">
                FROM
                <br />
                THIS…
                <svg viewBox="0 0 80 70" style={{ width: 80, height: 64, marginLeft: -56 }} aria-hidden>
                  <path d="M60 4C66 30 44 52 14 58M14 58l10-8M14 58l11 6" />
                </svg>
              </div>
            </div>
          </div>
          <div className="scribble sc-to" aria-hidden>
            …TO THIS
            <svg viewBox="0 0 80 60" style={{ width: 80, height: 56, margin: "-4px 0 0 96px" }} aria-hidden>
              <path d="M4 8c30-6 48 8 44 44M48 52l-10-8M48 52l6-11" />
            </svg>
          </div>
        </div>
      </TiltSection>

      <section className="app" id="app" aria-label="Your library, live">
        <div className="horizon" aria-hidden />
        <div className="wrap">
          <div className="win-stage">
            <div className="scribble sc-try" aria-hidden>
              HOVER A CARD —<br />
              RESIZE, PIN, BIN IT
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
                  <span className={`mq ${style}`}>{word}</span>
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
              Collections
            </span>
            <h2 className="h2">
              A place for every
              <br />
              <span className="it">rabbit hole.</span>
            </h2>
            <p className="lead">Keep your links in collections by what they actually are — not just another folder.</p>
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
                        <b>{d.name}</b>
                        <span>{d.count} links</span>
                      </div>
                    </div>
                    <div className="dk-img">
                      <Image src={d.img} alt={d.alt} sizes="(max-width: 760px) 50vw, 300px" />
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
              AnyLink for iPhone
            </span>
            <h2 className="h2">
              Save from any app
              <br />
              <span className="it">in one tap.</span>
            </h2>
          </div>
          <div className="sec-head" style={{ gap: 26 }}>
            <p className="lead">
              Share to AnyLink from anywhere and it’s filed before the sheet closes. Clear Unsorted with a swipe, read
              without the clutter, and share a whole collection with one link.
            </p>
            <div className="btns">
              {/* ponytail: no App Store listing yet — point this at it once the app is live. */}
              <a className="btn btn-glass" href="#iphone">
                <svg className="ic" viewBox="0 0 24 24" aria-hidden>
                  <rect x="6.5" y="2.5" width="11" height="19" rx="3" />
                  <path d="M10.5 18.5h3" />
                </svg>
                Get the iPhone app
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
                How it works
              </span>
              <h2 className="h2">
                From a pile
                <br />
                to a library.
              </h2>
              <p className="lead">
                Three steps, no filing required. AnyLink does the sorting so you can get back to the good stuff.
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
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                  <ul>
                    {s.details.map((d) => (
                      <li key={d}>
                        <svg className="ic" viewBox="0 0 24 24" aria-hidden>
                          <path d="M5 12.5l4.5 4.5L19 7.5" />
                        </svg>
                        {d}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <TiltSection className="cta">
        <div className="wrap cta-grid">
          <div className="cta-copy">
            <h2 className="h2">
              Everything worth
              <br />
              keeping. <span className="it">In one place.</span>
            </h2>
            <p className="lead">Save, organise and rediscover your favourite links — whenever inspiration strikes.</p>
            <div className="btns">
              <Link className="btn btn-acc" href="/start">
                Get started for free {ARROW}
              </Link>
              <Link className="btn btn-glass" href="/app">
                Open my library
              </Link>
            </div>
            <dl className="stats">
              {STATS.map((s) => (
                <div key={s.label}>
                  <dt>{s.label}</dt>
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
              SAME
              <br />
              IDEAS.
              <br />
              LESS
              <br />
              CHAOS.
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
          <nav className="foot-links" aria-label="Footer">
            {NAV.map((n) => (
              <a key={n.href} href={n.href}>
                {n.label}
              </a>
            ))}
            <Link href="/privacy-policy">Privacy Policy</Link>
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
