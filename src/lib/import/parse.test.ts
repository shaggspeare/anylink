// Run: node --test src/lib/import/parse.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { deflateRawSync } from "node:zlib";
import {
  mergeImports,
  parseBookmarks,
  parseImportBytes,
  parseImportFile,
  parseTelegram,
  parseText,
  parseWhatsApp,
} from "./parse.ts";

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

const WHATSAPP_IOS = `\u200e[15/03/2024, 14:23:05] Ann: Messages and calls are end-to-end encrypted.
[15/03/2024, 14:24:10] Ann: Rust macros guide https://example.com/macros.
and a second line
[16/03/2024, 9:01:00] Ben: \u200e<attached: 00000012-PHOTO-2024-03-16.jpg>
[16/03/2024, 9:02:00] Ben: www.example.com/kitchen, (also https://example.com/macros)`;

test("whatsapp: iPhone transcript, multi-line messages, context, dedupe, no file names", () => {
  const links = parseWhatsApp(WHATSAPP_IOS);
  assert.deepEqual(
    links.map((l) => l.url),
    ["https://example.com/macros", "https://www.example.com/kitchen"]
  );
  assert.equal(links[0].source, "whatsapp");
  assert.equal(links[0].title, "Rust macros guide");
  assert.equal(links[0].meta.context, "Rust macros guide . and a second line");
  assert.equal(links[0].meta.savedAt, new Date(2024, 2, 15, 14, 24, 10).toISOString());
});

test("whatsapp: Android lines, month-first and 12-hour dates", () => {
  const links = parseWhatsApp(
    "3/15/24, 2:23\u202fPM - Ann: https://example.com/a\n3/16/24, 12:05 AM - Ann: https://example.com/b"
  );
  assert.deepEqual(
    links.map((l) => l.meta.savedAt),
    [new Date(2024, 2, 15, 14, 23).toISOString(), new Date(2024, 2, 16, 0, 5).toISOString()]
  );
});

test("text: every http and www link, its line as context", () => {
  const links = parseText("Reading list:\nhttps://example.com/one great read\n\nsee www.example.com/two in notes.txt");
  assert.deepEqual(
    links.map((l) => [l.url, l.title, l.source]),
    [
      ["https://example.com/one", "great read", "text"],
      ["https://www.example.com/two", "see in notes", "text"],
    ]
  );
});

/** A real zip: one deflated entry, central directory, end record. */
function zip(entries: Record<string, string>): Uint8Array {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(entries)) {
    const raw = Buffer.from(text);
    const data = deflateRawSync(raw);
    const n = Buffer.from(name);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(8, 8);
    head.writeUInt32LE(data.length, 18);
    head.writeUInt32LE(raw.length, 22);
    head.writeUInt16LE(n.length, 26);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(8, 10);
    dir.writeUInt32LE(data.length, 20);
    dir.writeUInt32LE(raw.length, 24);
    dir.writeUInt16LE(n.length, 28);
    dir.writeUInt32LE(offset, 42);
    local.push(head, n, data);
    central.push(dir, n);
    offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...local, cd, end]));
}

test("zip: Safari export reads Bookmarks.html only, as Safari", async () => {
  const links = await parseImportBytes(
    "Safari Export 2026-01-13.zip",
    zip({ "Bookmarks.html": BOOKMARKS, "History.json": "{}", "__MACOSX/._Bookmarks.html": "x" })
  );
  assert.equal(links.length, 4);
  assert.equal(links[0].source, "safari");
});

test("zip: WhatsApp chat export", async () => {
  const links = await parseImportBytes("WhatsApp Chat - Ann.zip", zip({ "_chat.txt": WHATSAPP_IOS }));
  assert.equal(links.length, 2);
  assert.equal(links[0].source, "whatsapp");
});

test("dispatch: .txt reads as WhatsApp when it looks like one, else as text", () => {
  assert.equal(parseImportFile("notes.txt", WHATSAPP_IOS)[0].source, "whatsapp");
  assert.equal(parseImportFile("notes.txt", "https://example.com/x")[0].source, "text");
});
