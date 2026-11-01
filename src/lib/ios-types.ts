// ponytail: remove once no installed iOS build predates tolerant decoding.
/** iOS builds from before Phase 6 decode `contentType` strictly: one value they don't know fails their whole
 * library. So every iOS-facing payload goes through here, and a type the request's `X-AnyLink-Types` header
 * doesn't list reads as "article". New builds and the web app list what they know. */
const NEWER_TYPES = ["recipe"];

/** A `JSON.stringify` replacer for this request. */
export function contentTypesFor(request: Request) {
  const known = (request.headers.get("x-anylink-types") ?? "").split(",").map((t) => t.trim());
  const hidden = NEWER_TYPES.filter((t) => !known.includes(t));
  return (key: string, value: unknown) =>
    key === "contentType" && typeof value === "string" && hidden.includes(value) ? "article" : value;
}

/** `Response.json` for the iOS API. */
export function iosJson(request: Request, body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body, contentTypesFor(request)), {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
}
