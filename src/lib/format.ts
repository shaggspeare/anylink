/** "1 link", "12 links" — the same rule as iOS's `Int.linkCount`. */
export function linkCount(n: number): string {
  return `${n.toLocaleString("en")} ${n === 1 ? "link" : "links"}`;
}
