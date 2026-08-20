"use client";

import Link from "next/link";
import { useLibrary } from "@/lib/store";
import { CardMosaic } from "@/components/card-mosaic";
import { AmbientOrbs } from "@/components/ambient-orbs";

export default function WelcomePage() {
  const { links } = useLibrary();

  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">
      <AmbientOrbs variant="library" />
      <div className="relative mx-auto flex max-w-[1100px] flex-col items-center gap-6 px-4 pb-4 pt-16 text-center sm:pt-24">
        <span className="flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-eyebrow text-ink/50">
          <span className="flex h-5 w-5 items-center justify-center rounded-[7px] bg-ink text-[10px] font-bold text-[#f4f5f6]">A</span>
          AnyLink
        </span>
        <h1 className="text-display max-w-[720px] text-[40px] sm:text-[56px]">
          Paste anything. We read the rest.
        </h1>
        <p className="max-w-[480px] text-lead text-ink/55">
          A personal library for saved links — crawled, tagged, and filed into collections you
          actually browse.
        </p>
        <Link
          href="/"
          className="flex h-12 items-center rounded-full bg-ink px-7 text-body font-semibold text-[#f4f5f6]"
        >
          Open your library
        </Link>
      </div>
      <div className="relative mt-10 opacity-90">
        <CardMosaic links={links.slice(0, 8)} />
      </div>
    </div>
  );
}
