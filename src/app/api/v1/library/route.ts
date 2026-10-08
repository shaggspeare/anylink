import { getLibraryData } from "@/lib/db/queries";
import { unauthorized } from "../auth";

/** Everything the app renders from: `{ links, trashed, collections }`, same as the web layout loads. */
export async function GET() {
  return (await unauthorized()) ?? Response.json(await getLibraryData());
}
