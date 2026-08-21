export class CrawlError extends Error {
  constructor(
    message: string,
    public reason: "blocked" | "timeout" | "not-html" | "network" | "invalid-url"
  ) {
    super(message);
    this.name = "CrawlError";
  }
}
