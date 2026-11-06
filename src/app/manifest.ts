import type { MetadataRoute } from "next";
import { getT } from "@/i18n/server";

// Installable from the browser, and on Android it shows up in the share sheet: sharing a
// page to AnyLink lands on /app?shared_url=…, which GlobalCaptureListener opens in "Add a link".
// Browsers fetch the manifest without cookies, so it follows Accept-Language rather than the Settings pick.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getT();
  return {
    name: "AnyLink",
    short_name: "AnyLink",
    description: t("Paste anything. We read the rest."),
    start_url: "/app",
    display: "standalone",
    background_color: "#eceef0",
    theme_color: "#eceef0",
    icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" }],
    share_target: {
      action: "/app",
      method: "GET",
      params: { title: "shared_title", text: "shared_text", url: "shared_url" },
    },
  };
}
