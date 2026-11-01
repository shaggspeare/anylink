/** Words in paragraphs that read like prose: eight words or more, not nav labels or footers. */
function proseWords(paragraphs: string[]) {
  return paragraphs
    .map((p) => p.trim().split(/\s+/).filter(Boolean).length)
    .filter((n) => n >= 8)
    .reduce((sum, n) => sum + n, 0);
}

/** A few sentences of real prose. Scraped app shells (Instagram, SPAs) come back as menu labels and
 * copyright lines instead.
 * ponytail: word-count heuristic, swap for a Readability score at crawl time if it misfires. */
export function hasProse(articleText: string[] | undefined): articleText is string[] {
  return Boolean(articleText && proseWords(articleText) >= 40);
}

/** What the reader shows: the article, or the excerpt when there's no real prose. */
export function readableParagraphs(articleText: string[] | undefined, excerpt: string): string[] {
  if (hasProse(articleText)) return articleText;
  return excerpt ? [excerpt] : [];
}

/** A recipe time: 45 → "45 min", 60 → "1 h", 75 → "1 h 15 min". Same as iOS. */
export function minutesLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
}

/** A video's length: 253 → "4:13", 7262 → "2:01:02". */
export function clockLabel(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
