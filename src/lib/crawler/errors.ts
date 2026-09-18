export class CrawlError extends Error {
  constructor(
    message: string,
    public reason: "blocked" | "not-found" | "timeout" | "not-html" | "network" | "invalid-url",
    /** Body we did get back (block page, challenge, error shell). Often still
     * carries og: tags, so the pipeline gets a shot at salvaging metadata. */
    public html?: string
  ) {
    super(message);
    this.name = "CrawlError";
  }
}
