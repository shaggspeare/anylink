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
      "Paste a link and AnyLink reads the page, pulls out what matters and files it for you — or arrive with a thousand bookmarks you saved elsewhere and let it clear out the dead ones and group the rest. This tour covers everything the app does today, from saving to arranging your library by hand. Use the arrow keys or the buttons; Esc leaves at any point.",
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
      "Searches titles, summaries, notes, tags, domains and the full article text. The same box takes filters: <code>type:video</code>, <code>#design</code>, <code>-superman</code>, <code>\"exact phrase\"</code>, <code>is:favorite</code>, <code>created:&gt;2026-01</code>, <code>match:OR</code>. Press ⌘S to save any query as a named custom filter that re-runs itself.",
    side: "bottom",
    align: "end",
  },
  {
    page: "library",
    element: "[data-tour=mosaic]",
    title: "The library",
    description:
      "Everything you've saved, in a mosaic that packs cards of different sizes together. The next few steps show how to shape it: open, resize and rearrange.",
    side: "top",
  },
  {
    page: "library",
    element: "[data-tour=card]",
    title: "One card per link",
    description:
      "Hero image, source, title and tags — enough to recognise a page without opening it. Click a card for the reader view.",
    side: "right",
  },
  {
    page: "library",
    element: "[data-tour=card-open]",
    title: "Straight to the source",
    description:
      "Open takes you to the original page in a new tab — no stop at the reader view on the way.",
    side: "bottom",
  },
  {
    page: "library",
    element: "[data-tour=card-favorite]",
    title: "Favorites",
    description:
      "Star the ones worth keeping close. Favorites become their own filter in the sidebar.",
    side: "left",
  },
  {
    page: "library",
    element: "[data-tour=card-trash]",
    title: "Delete from the card",
    description: "Sends the link to Trash, where it waits until you restore it or empty the bin.",
    side: "left",
  },
  {
    page: "library",
    element: "[data-tour=card-menu]",
    title: "Card actions, behind ⋯",
    description:
      "Tap ⋯ on any card to open the original, favorite it or move it to Trash. Tap ✕ or anywhere else to close.",
    side: "bottom",
  },
  {
    page: "library",
    element: "[data-tour=card-size]",
    title: "Three sizes",
    description:
      "Every card is S, M or L. Hover a card and pick one here — L spans two columns, S drops the image for a compact line.",
    side: "left",
  },
  {
    page: "library",
    element: "[data-tour=card-resize]",
    title: "Or resize by dragging",
    description:
      "Grab the bottom-right corner and pull. The card stretches with your cursor, snaps to the nearest size as you pass it, and the cards around it slide out of the way. Drag wide for L, tall for M, back in for S. The size is saved with the link.",
    side: "left",
    align: "end",
  },
  {
    page: "library",
    element: "[data-tour=mosaic]",
    title: "Arrange by dragging",
    description:
      "Pick up any card and drop it where you want it — the others make room as you move, so you see the new layout before you let go. On a phone, hold a card for a moment until it lifts, then drag; near the top or bottom of the screen the page scrolls with you.",
    side: "top",
  },
  {
    page: "library",
    element: "[data-tour=sort]",
    title: "Sort it your way",
    description:
      "Newest, oldest, title or site — or <em>My order</em>, the arrangement you dragged. Dropping a card switches to it for you, so what you arranged never snaps back, and it's saved with the links.",
    side: "bottom",
    align: "end",
  },
  {
    page: "library",
    element: "[data-tour=sidebar]",
    title: "Collections",
    description:
      "Each collection gets a colour marker and a live count. Drag rows to put them in the order you want; Unsorted stays pinned on top. Rename or delete from the row itself — deleting sends its links to Trash rather than refusing.",
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
      "Favorites, articles, videos, products, notes, untagged, duplicates, broken links, archive. A filter only appears once something matches it, so this list always mirrors the library. Each one is just a saved query. <em>Broken links</em> stays current on its own: links are re-checked nightly, oldest first, not only when they arrive.",
    side: "right",
  },
  {
    page: "library",
    element: "[data-tour=custom-filters]",
    title: "Your own filters",
    description:
      "Any search can become a permanent filter: press ⌘S in the palette, give it a name, and it lives here re-running itself as the library grows. Drag them into whatever order you like, same as collections.",
    side: "right",
  },
  {
    page: "library",
    element: "[data-tour=themes]",
    title: "Collections that suggest themselves",
    description:
      "When enough links share a tag, that's a theme — AnyLink offers it as a ready-made collection. One click to keep it, one to wave it off.",
    side: "right",
  },
  {
    page: "library",
    element: "[data-tour=tags]",
    title: "Tags",
    description:
      "Tags are suggested at save time from the page's own metadata and from the words you already use, and listed here by how often you use them. One click filters the library.",
    side: "right",
  },
  {
    page: "library",
    element: "[data-tour=import]",
    title: "Bring the pile you already have",
    description:
      "Two sources: the HTML bookmarks export any browser produces, and the <code>result.json</code> from Telegram's Saved Messages export. Drop in both at once — anything saved in both places is merged into one link. Nothing is crawled at this point, so a few hundred bookmarks land in seconds, keeping their folder names and whatever you typed around them in Telegram.",
    side: "right",
  },
  {
    page: "library",
    element: "[data-tour=import]",
    title: "Then the dead ones come out",
    description:
      "Every imported link gets a request. Anything gone — a 404, a domain that no longer answers, a page that's turned into a squatter's \"buy this domain\" — is listed for you and moves to Trash in one click. Sites that merely refuse robots are left alone: a 403 or a rate limit means the page is fine in a browser, and throwing those away would cost you real links.",
    side: "right",
  },
  {
    page: "library",
    element: "[data-tour=import]",
    title: "And the rest gets sorted",
    description:
      "Four short questions — what you're working on, which of your own topics still interest you, keep-or-bin on a handful of links, anything you'd rather never see again. What survives comes back as a few named collections, ranked by how close they are to what you just said.",
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
    element: "[data-tour=collection-reasoning]",
    title: "Collections that say why they exist",
    description:
      "A collection AnyLink built during an import keeps its reasoning — what these links have in common, and why that matched what you said you were working on. Hand-made collections don't have one, because you already know.",
    side: "bottom",
    align: "start",
  },
  {
    page: "collection",
    element: "[data-tour=collection-filters]",
    title: "Narrow it down",
    description:
      "Filter by any tag used in this collection, and sort by date, title or site. Dragging, resizing and the card buttons all work here exactly as in the library.",
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
      "Arrive with a mess and leave with a library, capture the next one with a single paste, shape it by dragging cards and collections where you want them, find any of it again with one query language — and nothing you save is ever one click from being lost.",
  },
];
