import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // jsdom (via html-encoding-sniffer -> @exodus/bytes) and sharp don't survive
  // Turbopack's serverless bundling — run them from real node_modules instead.
  serverExternalPackages: [
    "jsdom",
    "@mozilla/readability",
    "sharp",
    "puppeteer-core",
    "@sparticuz/chromium",
  ],
  // @sparticuz/chromium ships its Chromium binary as extra files that Next's
  // automatic file tracing doesn't pick up — force them into the function output.
  outputFileTracingIncludes: {
    "/api/crawl": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
  // createImage takes the file as base64 in the action body (1 MB by default).
  experimental: {
    serverActions: { bodySizeLimit: "36mb" },
  },
  images: {
    // Hero images come from whatever domain the user pastes — wildcarded on purpose.
    // Next 16 still blocks local/private IPs by default, which covers the main SSRF risk.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
