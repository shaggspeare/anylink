import type { ContentType, ProductDetails } from "../types";

export type CrawlResult = {
  domain: string;
  canonicalUrl: string;
  title: string;
  excerpt: string;
  articleText: string[];
  heroImage?: string;
  favicon?: string;
  tint: string;
  stripe: string;
  initial: string;
  contentType: ContentType;
  suggestedTags: string[];
  readingTimeMinutes?: number;
  excerptOnly?: boolean;
  product?: ProductDetails;
};

export type CrawlStep = "fetch" | "parse" | "tags";
