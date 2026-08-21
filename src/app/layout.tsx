import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import "./globals.css";
import { LibraryProvider } from "@/lib/store";
import { CommandPalette } from "@/components/command-palette";
import { AddLinkFlow } from "@/components/add-link-flow";
import { GlobalCaptureListener } from "@/components/global-capture-listener";
import { getLibraryData } from "@/lib/db/queries";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "AnyLink",
  description: "Paste anything. We read the rest.",
};

// Every route reads the live library from Postgres via the root layout —
// none of it can be statically prerendered at build time.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { links, collections } = await getLibraryData();

  return (
    <html lang="en" className={`${instrumentSans.variable} h-full`}>
      <body className="min-h-full antialiased">
        <LibraryProvider initialLinks={links} initialCollections={collections}>
          {children}
          <AddLinkFlow />
          <CommandPalette />
          <GlobalCaptureListener />
        </LibraryProvider>
      </body>
    </html>
  );
}
