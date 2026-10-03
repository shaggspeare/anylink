import * as actions from "@/lib/db/actions";
import { unauthorized } from "../../auth";

/** Every server action the web app uses, over HTTP for the iOS app:
 * `POST /api/v1/actions/moveLinks` with the arguments as a JSON array, e.g. `[["id1"], "collectionId"]`.
 * One dispatcher instead of a route per action so the two clients can't drift apart. */
export async function POST(request: Request, ctx: RouteContext<"/api/v1/actions/[name]">) {
  const denied = unauthorized(request);
  if (denied) return denied;

  const { name } = await ctx.params;
  const action = Object.hasOwn(actions, name) ? actions[name as keyof typeof actions] : undefined;
  if (typeof action !== "function") return Response.json({ error: `Unknown action: ${name}` }, { status: 404 });

  const args = await request.json().catch(() => null);
  if (!Array.isArray(args)) return Response.json({ error: "Body must be a JSON array of arguments" }, { status: 400 });

  try {
    const result = await (action as (...a: unknown[]) => Promise<unknown>)(...args);
    return Response.json(result ?? null);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}
