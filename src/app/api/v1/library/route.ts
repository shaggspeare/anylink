import { getLibraryData } from "@/lib/db/queries";
import { unauthorized } from "../auth";

/** Everything the app renders from: `{ links, trashed, collections }`, same as the web layout loads. */
export async function GET(request: Request) {
  return unauthorized(request) ?? Response.json(await getLibraryData());
}
