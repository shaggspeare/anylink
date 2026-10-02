/** Words in paragraphs that read like prose: eight words or more, not nav labels or footers. */
function proseWords(paragraphs: string[]) {
  return paragraphs
    .map((p) => p.trim().split(/\s+/).filter(Boolean).length)
    .filter((n) => n >= 8)
    .reduce((sum, n) => sum + n, 0);
}

/** What the reader shows. Scraped app shells (Instagram, SPAs) come back as menu labels and
 * copyright lines; when there isn't a few sentences of real prose, the excerpt reads better.
 * ponytail: word-count heuristic, swap for a Readability score at crawl time if it misfires. */
export function readableParagraphs(articleText: string[] | undefined, excerpt: string): string[] {
  if (articleText && proseWords(articleText) >= 40) return articleText;
  return excerpt ? [excerpt] : [];
}
