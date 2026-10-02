import type { Metadata, Viewport } from "next";
import { Instrument_Sans } from "next/font/google";
import "./globals.css";
import { LibraryProvider } from "@/lib/store";
import { CommandPalette } from "@/components/command-palette";
import { AddLinkFlow } from "@/components/add-link-flow";
import { GlobalCaptureListener } from "@/components/global-capture-listener";
import { TourRunner } from "@/components/tour";
import { getLibraryData } from "@/lib/db/queries";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "AnyLink",
  description: "Paste anything. We read the rest.",
  // Added to the home screen, iOS opens it full-screen like an app.
  appleWebApp: { capable: true, title: "AnyLink", statusBarStyle: "default" },
};

// viewport-fit=cover lets the canvas run under the notch and home indicator; fixed
// chrome pads itself with env(safe-area-inset-*).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#eceef0",
};

// Every route reads the live library from Postgres via the root layout —
// none of it can be statically prerendered at build time.
export const dynamic = "force-dynamic";

// Runs before first paint: light unless the visitor picked dark.
// The theme-color meta is already parsed by then (it's emitted above this script), so the
// browser chrome gets the canvas colour too.
const THEME_SCRIPT = `try{if(localStorage.theme==="dark"){document.documentElement.classList.add("dark");document.querySelector('meta[name="theme-color"]')?.setAttribute("content","#0f1012")}}catch(e){}`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { links, trashed, collections } = await getLibraryData();

  return (
    // The head script adds `dark` before React hydrates.
    <html lang="en" className={`${instrumentSans.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full antialiased">
        <LibraryProvider
          initialLinks={links}
          initialTrashed={trashed}
          initialCollections={collections}
        >
          {children}
          <AddLinkFlow />
          <CommandPalette />
          <GlobalCaptureListener />
          <TourRunner />
        </LibraryProvider>
      </body>
    </html>
  );
}
