/** What Pro offers and where to buy it (docs/adr/0002), for the landing page and the Pro dialog. A plain module on
 * purpose: a server component that imports a value from a "use client" file gets a client reference, not the value. */

import { msg } from "@/i18n/translate";

/** AnyLink's App Store page. Null until the listing is live. Set it here: the Pro dialog links to it, and the landing
 * page shows its pricing section in production. */
export const APP_STORE_URL: string | null = null;

/** Same list as the iOS paywall (ios/docs/04-screens.md S19). */
export const PRO_BENEFITS = [
  msg("One library on your iPhone and the web"),
  msg("AI summaries and tags on every save"),
  msg("A second read in a full browser when a page won't load"),
  msg("Layouts for products, articles, videos and recipes"),
  msg("Price history and price alerts"),
  msg("Link health checks"),
  msg("Share links to your collections"),
  msg("Export as HTML, JSON or CSV"),
];
