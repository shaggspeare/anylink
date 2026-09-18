// Run: node --test src/lib/import/parse.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeImports, parseBookmarks, parseImportFile, parseTelegram } from "./parse.ts";

// Shaped exactly like a Chrome export: an unclosed <DT>, <DL><p> for every folder,
// a toolbar folder at the root, and one entry that isn't a web page at all.
const BOOKMARKS = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1700000000" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>
    <DL><p>
        <DT><A HREF="https://rust-lang.org/" ADD_DATE="1700000000">Rust &amp; friends</A>
        <DT><H3>Reading</H3>
        <DL><p>
            <DT><A HREF="https://example.com/borrow-checker">Borrow checker</A>
            <DT><A HREF="javascript:void(0)">A bookmarklet</A>
            <DT><A HREF="https://rust-lang.org/">Rust again</A>
        </DL><p>
        <DT><A HREF="https://example.com/after-folder">Back out one level</A>
    </DL><p>
    <DT><A HREF="https://example.com/root">Root level</A>
</DL><p>`;

test("bookmarks: folder trail, entities, dedupe, non-web hrefs", () => {
  const links = parseBookmarks(BOOKMARKS);

  assert.deepEqual(
    links.map((l) => [l.url, l.title, l.meta.folder]),
    [
      ["https://rust-lang.org/", "Rust & friends", "Bookmarks bar"],
      ["https://example.com/borrow-checker", "Borrow checker", "Bookmarks bar / Reading"],
      ["https://example.com/after-folder", "Back out one level", "Bookmarks bar"],
      ["https://example.com/root", "Root level", undefined],
    ]
  );
  assert.equal(links[0].source, "chrome");
  assert.equal(links[0].meta.savedAt, new Date(1700000000_000).toISOString());
});

test("bookmarks: a title-less anchor still gets a title", () => {
  const [link] = parseBookmarks(`<DL><DT><A HREF="https://example.com/some-post"></A></DL>`);
  assert.ok(link.title.length > 0);
});

const TELEGRAM = JSON.stringify({
  name: "Saved Messages",
  type: "saved_messages",
  messages: [
    {
      id: 1,
      type: "message",
      date: "2026-01-04T10:00:00",
      text_entities: [
        { type: "plain", text: "read this about rust macros " },
        { type: "link", text: "https://example.com/macros" },
      ],
    },
    { id: 2, type: "message", date: "2026-01-05T10:00:00", text_entities: [{ type: "plain", text: "groceries" }] },
    {
      id: 3,
      type: "message",
      date: "2026-01-06T10:00:00",
      text_entities: [{ type: "text_link", text: "this post", href: "https://example.com/post" }],
    },
    {
      id: 4,
      type: "message",
      date: "2026-01-07T10:00:00",
      text_entities: [{ type: "link", text: "https://example.com/macros" }],
    },
  ],
});

test("telegram: link + text_link entities, message text as context, dedupe", () => {
  const links = parseTelegram(TELEGRAM);

  assert.deepEqual(
    links.map((l) => l.url),
    ["https://example.com/macros", "https://example.com/post"]
  );
  assert.equal(links[0].title, "read this about rust macros");
  assert.equal(links[0].meta.context, "read this about rust macros");
  assert.equal(links[0].meta.savedAt, new Date("2026-01-04T10:00:00").toISOString());
  assert.equal(links[0].source, "telegram");
  // A hyperlink's own label is the context; the URL never leaks into it.
  assert.equal(links[1].title, "this post");
});

test("telegram: a full export reads only Saved Messages", () => {
  const links = parseTelegram(
    JSON.stringify({
      chats: {
        list: [
          {
            type: "private_supergroup",
            messages: [{ text_entities: [{ type: "link", text: "https://example.com/other-chat" }] }],
          },
          {
            type: "saved_messages",
            messages: [{ text_entities: [{ type: "link", text: "https://example.com/saved" }] }],
          },
        ],
      },
    })
  );
  assert.deepEqual(
    links.map((l) => l.url),
    ["https://example.com/saved"]
  );
});

test("merge: same URL from two sources lands once, first wins", () => {
  const merged = mergeImports([parseBookmarks(BOOKMARKS), parseTelegram(TELEGRAM)]);
  const rust = merged.filter((l) => l.url === "https://rust-lang.org/");

  assert.equal(rust.length, 1);
  assert.equal(rust[0].source, "chrome");
  assert.equal(merged.length, 6);
});

test("dispatch: .json reads as Telegram, .html as bookmarks", () => {
  assert.equal(parseImportFile("result.json", TELEGRAM)[0].source, "telegram");
  assert.equal(parseImportFile("bookmarks_9_18_26.html", BOOKMARKS)[0].source, "chrome");
});
