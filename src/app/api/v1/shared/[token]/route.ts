import { getSharedCollection } from "@/lib/db/queries";

/** A shared collection for the iOS viewer. No auth on purpose: the token is the credential
 * (docs/adr/0001). 404 once sharing is off. */
export async function GET(_request: Request, ctx: RouteContext<"/api/v1/shared/[token]">) {
  const shared = await getSharedCollection((await ctx.params).token);
  return shared ? Response.json(shared) : Response.json({ error: "Not shared" }, { status: 404 });
}
