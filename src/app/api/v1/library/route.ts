import { getLibraryData } from "@/lib/db/queries";
import { iosJson } from "@/lib/ios-types";
import { unauthorized } from "../auth";

/** Everything the app renders from: `{ links, trashed, collections, displayName, plan }`, same as the web layout loads. */
export async function GET(request: Request) {
  return (await unauthorized()) ?? iosJson(request, await getLibraryData());
}
