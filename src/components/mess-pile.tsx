import Image from "next/image";
import { Caveat } from "next/font/google";
import villa from "../../public/images/hero/villa.webp";
import sneaker from "../../public/images/hero/sneaker.webp";
import book from "../../public/images/hero/book.webp";
import camera from "../../public/images/hero/camera.webp";
import pasta from "../../public/images/hero/pasta.webp";
import barcelona from "../../public/images/hero/barcelona.webp";
import house from "../../public/images/hero/house.webp";
import apartamento from "../../public/images/hero/apartamento.webp";
import plant from "../../public/images/hero/plant.webp";
import maps from "../../public/images/hero/maps.webp";

/** Landing-hero collage: saved things and link cards tossed into one pile. */

const caveat = Caveat({ subsets: ["latin"], weight: "500" });

// Each image is a finished tile (card, rotation and transparency baked in, padding trimmed).
// left/top/width are % of the square pile box, so the pile scales as one piece;
// rotate (deg) tilts on top of the angle already baked into the image.
const TILES = [
  { img: plant, rotate: 12, left: 36, top: 73, width: 24, z: 1 },
  { img: house, rotate: 7, left: 62, top: 27, width: 32, z: 2 },
  { img: villa, rotate: -9, left: 11, top: 0, width: 27, z: 3 },
  { img: book, rotate: 10, left: 22, top: 14, width: 35, z: 4 },
  { img: sneaker, rotate: -8, left: 40, top: 4, width: 41, z: 5 },
  { img: camera, rotate: -10, left: 0, top: 43, width: 34, z: 6 },
  { img: maps, rotate: -7, left: 60, top: 68, width: 38, z: 6 },
  { img: pasta, rotate: -5, left: 0, top: 61, width: 35, z: 7 },
  { img: barcelona, rotate: 4, left: 34, top: 45, width: 30, z: 8 },
  { img: apartamento, rotate: -4, left: 63, top: 42, width: 36, z: 9 },
];

export function MessPile() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[700px]" aria-hidden>
      {TILES.map((t, i) => {
        // Fly in from outside the pile, along the line from its centre through the tile.
        const dx = (t.left + t.width / 2 - 50) * 6;
        const dy = (t.top + 12 - 50) * 6;
        return (
          <div
            key={t.img.src}
            className="pile-tile absolute"
            style={{
              left: `${t.left}%`,
              top: `${t.top}%`,
              width: `${t.width}%`,
              zIndex: t.z,
              rotate: `${t.rotate}deg`,
              "--from": `${dx}px ${dy}px`,
              "--spin": `${i % 2 ? 14 : -14}deg`,
              "--delay": `${i * 70}ms`,
              "--float": `${5 + (i % 4)}s`,
            } as React.CSSProperties}
          >
            <Image
              src={t.img}
              alt=""
              loading="eager"
              sizes="(min-width: 768px) 280px, 40vw"
              className="h-auto w-full drop-shadow-[0_18px_24px_rgba(23,24,27,0.22)]"
            />
          </div>
        );
      })}
      {/* Sits right of the sneaker; the arrow lands on its toe. Needs the room xl gives. */}
      <Scribble className="absolute top-[-2%] left-[87%] z-10 hidden rotate-6 xl:flex">
        FROM
        <br />
        THIS…
        <svg viewBox="0 0 80 70" className="-ml-14 h-16 w-20" aria-hidden>
          <path d="M60 4C66 30 44 52 14 58M14 58l10-8M14 58l11 6" />
        </svg>
      </Scribble>
    </div>
  );
}

/** Handwritten margin note. */
export function Scribble({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <div
      className={`${caveat.className} pointer-events-none flex-col text-[26px] leading-[1.05] tracking-wide text-ink/70 [&_path]:fill-none [&_path]:stroke-current [&_path]:stroke-[1.6] [&_path]:[stroke-linecap:round] ${className}`}
      aria-hidden
    >
      {children}
    </div>
  );
}
