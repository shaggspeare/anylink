// Run: node --test src/lib/ios-types.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { iosJson } from "./ios-types.ts";

const library = { links: [{ id: "a", contentType: "recipe", templateData: { ingredients: ["salt"] } }, { id: "b", contentType: "video" }] };
const ask = (headers?: Record<string, string>) => iosJson(new Request("https://anylink.space/api/v1/library", { headers }), library).json();

test("a build that doesn't list recipe gets article; one that does gets recipe", async () => {
  const old = await ask();
  assert.deepEqual(old.links.map((l: { contentType: string }) => l.contentType), ["article", "video"]);
  assert.deepEqual(old.links[0].templateData, { ingredients: ["salt"] }, "the rest of the link is untouched");

  const fresh = await ask({ "X-AnyLink-Types": "article,video,product,note,image,recipe" });
  assert.deepEqual(fresh.links.map((l: { contentType: string }) => l.contentType), ["recipe", "video"]);
});
