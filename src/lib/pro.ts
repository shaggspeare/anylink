/** What Pro offers and where to buy it (docs/adr/0002), for the landing page and the Pro dialog. A plain module on
 * purpose: a server component that imports a value from a "use client" file gets a client reference, not the value. */

/** AnyLink's App Store page. Null until the listing is live. Set it here: the Pro dialog links to it, and the landing
 * page shows its pricing section in production. */
export const APP_STORE_URL: string | null = null;

/** Same list as the iOS paywall (ios/docs/04-screens.md S19). */
export const PRO_BENEFITS = [
  "One library on your iPhone and the web",
  "AI summaries and tags on every save",
  "A second read in a full browser when a page won't load",
  "Layouts for products, articles, videos and recipes",
  "Price history and price alerts",
  "Link health checks",
  "Share links to your collections",
  "Export as HTML, JSON or CSV",
];
