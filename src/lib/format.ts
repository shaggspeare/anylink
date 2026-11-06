import type { T } from "@/i18n/translate";

/** "1 link", "12 links" — the same rule as iOS's `Int.linkCount`. */
export function linkCount(n: number, t: T): string {
  return t("{count} link|{count} links", { count: n });
}
