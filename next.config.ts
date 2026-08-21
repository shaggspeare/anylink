import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // jsdom (via html-encoding-sniffer -> @exodus/bytes) and sharp don't survive
  // Turbopack's serverless bundling — run them from real node_modules instead.
  serverExternalPackages: ["jsdom", "@mozilla/readability", "sharp"],
  images: {
    // Hero images come from whatever domain the user pastes — wildcarded on purpose.
    // Next 16 still blocks local/private IPs by default, which covers the main SSRF risk.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
