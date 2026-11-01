import { currentPlan } from "@/lib/db/current-user";
import { getLibraryData } from "@/lib/db/queries";
import { toBookmarksHtml, toCsv, toExportJson, type ExportLibrary } from "@/lib/export";
import { isPro, PRO_REQUIRED } from "@/lib/plan";
import { unauthorized } from "../auth";

const FORMATS: Record<string, { type: string; write: (library: ExportLibrary, now: Date) => string }> = {
  html: { type: "text/html", write: toBookmarksHtml },
  json: { type: "application/json", write: toExportJson },
  csv: { type: "text/csv", write: toCsv },
};

/** The library as a file to keep, Trash left out: `?format=html` (bookmarks for any browser), `json` (everything)
 * or `csv` (a spreadsheet). Pro only. A free account gets 403 `{ ok: false, reason: "pro" }`, not 401, so iOS
 * keeps it signed in. Web sends the cookie, iOS a Bearer token. */
export async function GET(request: Request) {
  const denied = await unauthorized();
  if (denied) return denied;
  const format = new URL(request.url).searchParams.get("format") ?? "";
  const file = Object.hasOwn(FORMATS, format) ? FORMATS[format] : undefined;
  if (!file) return Response.json({ error: "format must be html, json or csv" }, { status: 400 });
  if (!isPro(await currentPlan())) return Response.json(PRO_REQUIRED, { status: 403 });

  const now = new Date();
  return new Response(file.write(await getLibraryData(), now), {
    headers: {
      "Content-Type": `${file.type}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="anylink-${now.toISOString().slice(0, 10)}.${format}"`,
    },
  });
}
