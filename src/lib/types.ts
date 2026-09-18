export type CardSize = "S" | "M" | "L";
export type ContentType = "article" | "video" | "product";
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
  /** 'manual' | 'chrome' | 'telegram' — where the link entered the library. */
  source?: string;
  /** What the export file knew: bookmark folder, Telegram message text, saved date. */
  importMeta?: ImportMeta;
  note?: string;
  favorite?: boolean;
  /** null/undefined = never checked, 0 = unreachable, else the last HTTP status. */
  httpStatus?: number;
  archived?: boolean;
  deleted?: boolean;
  highlights?: Highlight[];
  product?: ProductDetails;
};

export type Collection = {
  id: string;
  name: string;
  color: string;
  isSmart?: boolean;
  smartQuery?: string;
  isInbox?: boolean;
  /** Why the grouper put these links together. Only set on `createdBy: 'system'`. */
  reasoning?: string;
  createdBy?: string;
};
