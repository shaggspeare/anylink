import { getSharedCollection } from "@/lib/db/queries";
import { iosJson } from "@/lib/ios-types";

/** A shared collection for the iOS viewer. No auth on purpose: the token is the credential
 * (docs/adr/0001). 404 once sharing is off. */
export async function GET(request: Request, ctx: RouteContext<"/api/v1/shared/[token]">) {
  const shared = await getSharedCollection((await ctx.params).token);
  return shared ? iosJson(request, shared) : Response.json({ error: "Not shared" }, { status: 404 });
}
