import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import "./globals.css";
import { LibraryProvider } from "@/lib/store";
import { CommandPalette } from "@/components/command-palette";
import { AddLinkFlow } from "@/components/add-link-flow";
import { GlobalCaptureListener } from "@/components/global-capture-listener";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "AnyLink",
  description: "Paste anything. We read the rest.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${instrumentSans.variable} h-full`}>
      <body className="min-h-full antialiased">
        <LibraryProvider>
          {children}
          <AddLinkFlow />
          <CommandPalette />
          <GlobalCaptureListener />
        </LibraryProvider>
      </body>
    </html>
  );
}
