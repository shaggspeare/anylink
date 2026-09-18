/** The guided demo. Steps are data; the runner resolves each page to a real route
 * (a real collection, a real article, a real product) and drops any step whose
 * element isn't on screen — so a thin library demos as well as a full one. */

export type TourPage = "library" | "collection" | "link" | "product" | "trash";

export type TourStep = {
  page: TourPage;
  /** CSS selector; the first match wins. Omit for a centred, element-less step. */
  element?: string;
  title: string;
  description: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
};

export const TOUR_STEPS: TourStep[] = [
  {
    page: "library",
    title: "Welcome to AnyLink",
    description:
      "Paste a link — AnyLink reads the page, pulls out what matters and files it for you. This tour covers everything the app does today. Use the arrow keys or the buttons; Esc leaves at any point.",
  },
  {
    page: "library",
    element: "[data-tour=add]",
    title: "Save anything",
    description:
      "Paste a URL here, or press ⌘V anywhere in the app. AnyLink fetches the page and streams its progress: title, summary, hero image, reading time and suggested tags. Sites that block bots get a headless-browser retry; paywalled ones save what metadata they expose. The form stays editable either way.",
    side: "bottom",
    align: "end",
  },
  {
    page: "library",
    element: "[data-tour=search]",
    title: "Search everything, ⌘K",
    description:
      "Searches titles, summaries, notes, tags, domains and the full article text. The same box takes filters: <code>type:video</code>, <code>#design</code>, <code>-superman</code>, <code>\"exact phrase\"</code>, <code>is:favorite</code>, <code>created:&gt;2026-01</code>, <code>match:OR</code>. Press ⌘S to save any query as a smart collection that re-runs itself.",
    side: "bottom",
    align: "end",
  },
  {
    page: "library",
    element: "[data-tour=mosaic]",
    title: "The library",
    description:
      "Everything you've saved, newest first, in a mosaic that packs cards of different sizes together.",
    side: "top",
  },
  {
    page: "library",
    element: "[data-tour=card]",
    title: "One card per link",
    description:
      "Hero image, source, title and tags — enough to recognise a page without opening it. Click through for the reader view.",
    side: "right",
  },
  {
    page: "library",
    element: "[data-tour=card-favorite]",
    title: "Favorites",
    description:
      "Star the ones worth keeping close. Favorites become their own filter in the sidebar.",
    side: "right",
  },
  {
    page: "library",
    element: "[data-tour=card-size]",
    title: "Three sizes, or drag",
    description:
      "S, M or L per card — or grab the bottom-right corner and drag; the card snaps to the nearest size. Sizes are saved with the link.",
    side: "left",
  },
  {
    page: "library",
    element: "[data-tour=sidebar]",
    title: "Collections",
    description:
      "Each collection gets a colour marker and a live count. Rename or delete from the row itself — deleting sends its links to Trash rather than refusing.",
    side: "right",
  },
  {
    page: "library",
    element: "[data-tour=inbox]",
    title: "Unsorted, the inbox",
    description:
      "Saving never asks you to decide where something goes — links land in Unsorted and you file them when you feel like it.",
    side: "right",
  },
  {
    page: "library",
    element: "[data-tour=filters]",
    title: "Filters that build themselves",
    description:
      "Favorites, articles, videos, products, notes, untagged, duplicates, broken links, archive. A filter only appears once something matches it, so this list always mirrors the library. Each one is just a saved query.",
    side: "right",
  },
  {
    page: "library",
    element: "[data-tour=tags]",
    title: "Tags",
    description:
      "Tags are suggested at save time and listed here by how often you use them. One click filters the library.",
    side: "right",
  },
  {
    page: "library",
    element: "[data-tour=import]",
    title: "Bring your bookmarks",
    description:
      "Drop in the HTML export from any browser. Every bookmark runs through the same crawler, so you get summaries and images for links you saved years ago.",
    side: "right",
  },
  {
    page: "library",
    element: "[data-tour=cleanup]",
    title: "Housekeeping",
    description: "Clears out collections that ended up empty after a reorganisation.",
    side: "right",
  },
  {
    page: "library",
    element: "[data-tour=trash]",
    title: "Nothing is deleted outright",
    description:
      "Deleted links wait in Trash until you empty it. We'll come back here at the end of the tour.",
    side: "right",
  },
  {
    page: "collection",
    element: "[data-tour=collection-header]",
    title: "Inside a collection",
    description: "The same mosaic, scoped to one collection.",
    side: "bottom",
    align: "start",
  },
  {
    page: "collection",
    element: "[data-tour=collection-filters]",
    title: "Narrow it down",
    description:
      "Filter by any tag used in this collection, and sort by newest, oldest or title.",
    side: "bottom",
    align: "start",
  },
  {
    page: "collection",
    element: "[data-tour=card-select]",
    title: "Select many, act once",
    description:
      "Tick a card to enter selection mode, then shift-click for a whole range. The bar at the bottom moves, tags, archives or deletes everything you picked in one go.",
    side: "right",
  },
  {
    page: "link",
    element: "[data-tour=reader]",
    title: "Reader view",
    description:
      "The article itself — no ads, no cookie banners, no newsletter pop-up. Stored at save time, so it stays readable even if the page changes.",
    side: "right",
  },
  {
    page: "link",
    element: "[data-tour=article]",
    title: "Highlights",
    description:
      "Select any passage and click Highlight. Highlights are saved with the link and show up whenever you come back to it.",
    side: "right",
  },
  {
    page: "link",
    element: "[data-tour=note]",
    title: "Your own note",
    description:
      "Why you saved it, what to do with it. Notes are searchable — <code>note:invoice</code> — and the sidebar grows a \"With a note\" filter.",
    side: "bottom",
    align: "end",
  },
  {
    page: "link",
    element: "[data-tour=favorite]",
    title: "Favorite from anywhere",
    description: "Same star as on the card — it's the same flag, wherever you flip it.",
    side: "bottom",
    align: "end",
  },
  {
    page: "link",
    element: "[data-tour=move]",
    title: "Refile in a click",
    description: "Move the link into another collection without leaving the page.",
    side: "bottom",
    align: "end",
  },
  {
    page: "link",
    element: "[data-tour=open-original]",
    title: "The original is one click away",
    description: "AnyLink never gets between you and the source.",
    side: "bottom",
    align: "end",
  },
  {
    page: "product",
    element: "[data-tour=product]",
    title: "Product pages are different",
    description:
      "When a page turns out to be a product, AnyLink reads its structured data instead of its prose: price, availability, variants and whatever specs the retailer publishes.",
    side: "left",
  },
  {
    page: "product",
    element: "[data-tour=price-history]",
    title: "Price history",
    description:
      "AnyLink re-checks saved products twice a day and charts what it finds, so you can see whether that \"sale\" is really a sale.",
    side: "left",
  },
  {
    page: "product",
    element: "[data-tour=price-alert]",
    title: "Tell me when it drops",
    description: "Set a threshold and the price delta is flagged as soon as it's crossed.",
    side: "left",
  },
  {
    page: "trash",
    element: "[data-tour=trash-item]",
    title: "Trash, not gone",
    description:
      "Restore anything, or delete it for good on your own terms. Deleting a whole collection lands its links here too.",
    side: "bottom",
  },
  {
    page: "library",
    title: "That's AnyLink",
    description:
      "Capture with one paste, enrich automatically, find it again with one query language across search, filters and smart collections — and nothing you save is ever one click from being lost.",
  },
];
