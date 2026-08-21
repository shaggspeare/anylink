import { structureContent, type StructureInput } from "@/lib/structure/structure-content";

export const runtime = "edge";

export async function POST(request: Request) {
  const input = (await request.json().catch(() => null)) as StructureInput | null;

  if (!input || typeof input.rawText !== "string" || !input.rawText) {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  const result = await structureContent(input);
  if (!result) {
    return Response.json({ error: "Structuring failed" }, { status: 502 });
  }

  return Response.json(result);
}
