import { test } from "node:test";
import assert from "node:assert/strict";
import { makeT } from "./translate.ts";
import { matchLocale } from "./locales.ts";

test("falls back to the English key, plural in the key", () => {
  const t = makeT({});
  assert.equal(t("Save"), "Save");
  assert.equal(t("{count} link|{count} links", { count: 1 }), "1 link");
  assert.equal(t("{count} link|{count} links", { count: 1200 }), "1,200 links");
});

test("picks the language's plural form", () => {
  const t = makeT({ "{count} link|{count} links": { one: "{count} ссылка", few: "{count} ссылки", many: "{count} ссылок" }, Save: "Сохранить" }, "ru");
  assert.equal(t("Save"), "Сохранить");
  assert.equal(t("{count} link|{count} links", { count: 1 }), "1 ссылка");
  assert.equal(t("{count} link|{count} links", { count: 3 }), "3 ссылки");
  assert.equal(t("{count} link|{count} links", { count: 5 }), "5 ссылок");
});

test("matches Accept-Language", () => {
  assert.equal(matchLocale("de-CH,de;q=0.9,en;q=0.8"), "de");
  assert.equal(matchLocale("zh-CN"), "zh-Hans");
  assert.equal(matchLocale("pt-PT"), "pt-BR");
  assert.equal(matchLocale("nl,fr;q=0.5"), "fr");
  assert.equal(matchLocale(null), "en");
});
