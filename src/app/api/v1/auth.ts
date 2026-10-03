import { timingSafeEqual } from "node:crypto";

/** The native app's way in: `Authorization: Bearer $API_TOKEN`. Fails closed — no token
 * configured means no API, since these routes hand out the whole library. */
export function unauthorized(request: Request): Response | null {
  const token = process.env.API_TOKEN;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${token}`);
  if (token && given.length === expected.length && timingSafeEqual(given, expected)) return null;
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
