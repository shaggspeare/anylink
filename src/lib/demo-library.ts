import { identityForDomain } from "./card-identity";
import type { Collection, ContentType, LinkItem } from "./types";

/** The library a guest starts with — on the landing page and in /app — until they sign in.
 *  Photos: Unsplash. */

export const DEMO_COLLECTIONS: Collection[] = [
  { id: "unsorted", name: "Unsorted", color: "#9aa3ad", isInbox: true },
  { id: "reading", name: "Reading", color: "var(--signal-orange)" },
  { id: "inspiration", name: "Inspiration", color: "#e0855a" },
  { id: "shopping", name: "Shopping", color: "var(--periwinkle)" },
  { id: "travel", name: "Travel", color: "var(--lime)" },
  { id: "watch", name: "Watch later", color: "var(--slate)" },
];

export type DemoRow = [
  title: string,
  url: string,
  image: string,
  type: ContentType,
  collectionId: string,
  extra?: Partial<LinkItem>,
];

const DEMO: DemoRow[] = [
  ["The dreamiest hotels in Portugal", "https://www.cntraveler.com/gallery/best-hotels-in-portugal", "villa", "article", "travel"],
  ["New Balance 1906R", "https://www.newbalance.com/pd/1906r/M1906R.html", "sneakers", "product", "shopping"],
  ["A visual guide to Barcelona", "https://www.notboring.co/barcelona", "barcelona", "article", "travel"],
  ["Dieter Rams: a legendary minimalist", "https://www.youtube.com/watch?v=dieter-rams", "book", "video", "watch"],
  ["Good coffee at home", "https://sprudge.com/good-coffee-at-home", "coffee", "article", "reading"],
  ["Tokyo street photography", "https://petapixel.com/tokyo-street-photography", "tokyo", "article", "inspiration"],
  ["Home office inspirations", "https://www.pinterest.com/ideas/home-office", "office", "article", "inspiration"],
  ["Ultimate Japan travel guide", "https://www.notion.so/japan-travel-guide", "kyoto", "article", "travel"],
];

/** Demo rows → full LinkItems; `image` is a file name in /public/images/demo. */
export function toDemoLinks(rows: DemoRow[]): LinkItem[] {
  return rows.map(([title, url, image, contentType, collectionId, extra], i) => {
    const domain = new URL(url).hostname.replace(/^www\./, "");
    return {
      id: `demo-${i}`,
      url,
      domain,
      title,
      excerpt: "",
      heroImage: `/images/demo/${image}.webp`,
      ...identityForDomain(domain),
      contentType,
      collectionId,
      tags: [],
      size: "M",
      status: "ready",
      createdAt: new Date(2026, 8, 20 - i).toISOString(),
      ...extra,
    };
  });
}

export const DEMO_LINKS = toDemoLinks(DEMO);
