export const CARD_SIZES = ["S", "M", "L"] as const;
export type CardSize = (typeof CARD_SIZES)[number];
/** `note` and `image` aren't pages: their `url` is empty (note) or the stored file (image),
 * `domain` is empty, and a note's text lives in `excerpt`. */
export type ContentType = "article" | "video" | "product" | "note" | "image" | "recipe";
export type LinkStatus = "crawling" | "ready" | "failed";

export type Highlight = {
  id: string;
  quote: string;
  note?: string;
};

export type PriceSnapshot = {
  date: string;
  price: number;
};

export type ProductDetails = {
  retailer: string;
  retailerInitial: string;
  retailerColor: string;
  code?: string;
  price?: number;
  previousPrice?: number;
  currency: string;
  inStock?: boolean;
  delivery?: string;
  rating?: number;
  reviewCount?: number;
  warranty?: string;
  variants: { label: string; swatch: string }[];
  specs: { label: string; value: string }[];
  totalSpecCount: number;
  priceHistory: PriceSnapshot[];
  alertThreshold?: number;
};

/** What a template shows beyond the card (`links.template_data`), read from the page itself, never from AI.
 * Which fields are set depends on the content type. Counts are whole numbers: iOS decodes them as Int. */
export type TemplateData = {
  // article
  author?: string;
  /** ISO 8601. */
  publishedAt?: string;
  // video
  /** "youtube" | "vimeo" | the site's domain */
  provider?: string;
  videoId?: string;
  channel?: string;
  durationSeconds?: number;
  // recipe
  ingredients?: string[];
  steps?: string[];
  prepMinutes?: number;
  cookMinutes?: number;
  totalMinutes?: number;
  yield?: string;
};

export type ImportMeta = {
  folder?: string;
  savedAt?: string;
  context?: string;
};

export type LinkItem = {
  id: string;
  url: string;
  domain: string;
  title: string;
  excerpt: string;
  articleText?: string[];
  heroImage?: string;
  tint: string;
  stripe: string;
  initial: string;
  contentType: ContentType;
  readingTimeMinutes?: number;
  collectionId: string;
  tags: string[];
  size: CardSize;
  /** Manual sort order; 0 until the card is dragged somewhere. */
  position?: number;
  status: LinkStatus;
  createdAt: string;
  /** 'manual' | 'chrome' | 'safari' | 'telegram' | 'whatsapp' | 'text' — where the link entered the library. */
  source?: string;
  /** What the export file knew: bookmark folder, Telegram message text, saved date. */
  importMeta?: ImportMeta;
  note?: string;
  favorite?: boolean;
  /** At most two live links can be pinned across the library. */
  pinned?: boolean;
  /** null/undefined = never checked, 0 = unreachable, else the last HTTP status. */
  httpStatus?: number;
  archived?: boolean;
  deleted?: boolean;
  highlights?: Highlight[];
  product?: ProductDetails;
  templateData?: TemplateData;
  /** Saved without the AI step (a free crawl, or an upload from an iOS local library). A Pro account opening it runs
   * `enrichLink`, which adds the summary and tags. */
  aiPending?: boolean;
  /** The id it had in an iOS local library before the upgrade uploaded it (`uploadLibrary`). */
  clientId?: string;
};

export type Collection = {
  id: string;
  name: string;
  color: string;
  /** An emoji shown in place of the colour dot. */
  icon?: string;
  isSmart?: boolean;
  smartQuery?: string;
  isInbox?: boolean;
  /** Why the grouper put these links together. Only set on `createdBy: 'system'`. */
  reasoning?: string;
  createdBy?: string;
  /** Set while the collection is shared: its public URL is `/s/<shareToken>`. */
  shareToken?: string;
};

/** What a share link shows: a collection's live contents, cut down to the fields a viewer
 * may see (docs/adr/0001). Links keep the LinkItem shape so cards render them as-is. */
export type SharedCollection = {
  name: string;
  color: string;
  icon?: string;
  /** The owner's display name, if they set one. */
  ownerName?: string;
  links: LinkItem[];
};
