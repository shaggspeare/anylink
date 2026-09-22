// Run: node --test src/lib/geometry.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { columnsForWidth, sizeFromDrag } from "./geometry.ts";

test("sizeFromDrag snaps a corner drag to the three card sizes", () => {
  const unit = 280;
  assert.equal(sizeFromDrag(280, 180, unit), "S");
  assert.equal(sizeFromDrag(280, 300, unit), "M");
  assert.equal(sizeFromDrag(430, 180, unit), "L");
  // Width wins: a card dragged wide stays L however short it is.
  assert.equal(sizeFromDrag(430, 100, unit), "L");
});

test("columnsForWidth follows the mosaic breakpoints", () => {
  assert.equal(columnsForWidth(1400), 4);
  assert.equal(columnsForWidth(1000), 3);
  assert.equal(columnsForWidth(700), 2);
  assert.equal(columnsForWidth(400), 1);
});
