export class CrawlError extends Error {
  reason: "blocked" | "not-found" | "timeout" | "not-html" | "network" | "invalid-url";
  /** Body we did get back (block page, challenge, error shell). Often still
   * carries og: tags, so the pipeline gets a shot at salvaging metadata. */
  html?: string;

  // Plain fields rather than parameter properties: node's type-stripping can't parse
  // those, and `node --test` has to be able to load anything a test reaches.
  constructor(message: string, reason: CrawlError["reason"], html?: string) {
    super(message);
    this.name = "CrawlError";
    this.reason = reason;
    this.html = html;
  }
}
