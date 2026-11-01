// Run: node --test src/lib/crawler/parse-page.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { isoDurationSeconds, parseHtml } from "./parse-page.ts";
import { videoEmbedUrl, videoFromUrl } from "./url.ts";

const filler = "Plenty of words here so Readability treats this as the article body. ".repeat(8);

test("article body keeps lists, headings and code, decodes entities, no duplicates", () => {
  const html = `<html><head><title>T</title></head><body><article>
    <h1>T</h1>
    <p>${filler}</p>
    <h2>Setup &amp; config</h2>
    <p>It&#8217;s ${filler}</p>
    <ul><li>first item</li><li><p>second item</p></li></ul>
    <pre>const a = 1;
const b = 2;</pre>
    <blockquote><p>quoted line</p></blockquote>
    <p>${filler}</p>
  </article></body></html>`;

  const { articleText } = parseHtml(html, "https://example.com/post");

  assert.ok(articleText.includes("Setup & config"));
  assert.ok(articleText.some((p) => p.startsWith("It’s ")));
  assert.ok(articleText.includes("first item"));
  assert.equal(articleText.filter((p) => p === "second item").length, 1);
  assert.ok(articleText.includes("const a = 1;\nconst b = 2;"));
  assert.equal(articleText.filter((p) => p === "quoted line").length, 1);
});

test("review counts come out whole: 1.2K is 1200, not 1.2", () => {
  const ld = (count: string) => `<html><head><title>P</title><script type="application/ld+json">${JSON.stringify({
    "@type": "Product", name: "P", aggregateRating: { ratingValue: "4.5", reviewCount: count },
  })}</script></head><body><p>${filler}</p></body></html>`;
  assert.equal(parseHtml(ld("1.2K"), "https://shop.example/p").product?.reviewCount, 1200);
  assert.equal(parseHtml(ld("1,234 reviews"), "https://shop.example/p").product?.reviewCount, 1234);
});

const page = (head: string, body = `<article><p>${filler}</p><p>${filler}</p></article>`) =>
  `<html><head><title>T</title>${head}</head><body>${body}</body></html>`;
const jsonLd = (node: object) => `<script type="application/ld+json">${JSON.stringify(node)}</script>`;

test("Recipe JSON-LD makes a recipe: ingredients, steps from sections, times and yield", () => {
  const html = page(
    jsonLd({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage", name: "Ramen" },
        {
          "@type": ["Recipe"],
          name: "Weeknight ramen",
          recipeIngredient: ["2 eggs", "1 litre stock &amp; bones", "<b>4 tbsp</b> soy sauce", ""],
          recipeInstructions: [
            { "@type": "HowToSection", name: "Broth", itemListElement: [{ "@type": "HowToStep", text: "Simmer the stock." }] },
            { "@type": "HowToStep", text: "Boil the eggs." },
            "Serve.",
          ],
          prepTime: "PT15M",
          cookTime: "PT45M",
          totalTime: "PT1H",
          recipeYield: ["2", "2 bowls"],
        },
        { "@type": "VideoObject", name: "How to", contentUrl: "https://cdn.example/ramen.mp4" },
      ],
    })
  );
  const r = parseHtml(html, "https://www.seriouseats.com/weeknight-ramen");
  assert.equal(r.contentType, "recipe", "a recipe's own video doesn't make it a video");
  assert.deepEqual(r.templateData?.ingredients, ["2 eggs", "1 litre stock & bones", "4 tbsp soy sauce"]);
  assert.deepEqual(r.templateData?.steps, ["Simmer the stock.", "Boil the eggs.", "Serve."]);
  assert.equal(r.templateData?.prepMinutes, 15);
  assert.equal(r.templateData?.cookMinutes, 45);
  assert.equal(r.templateData?.totalMinutes, 60);
  assert.equal(r.templateData?.yield, "2 bowls");
});

test("recipe instructions as one blob read a step per line; without a Recipe it stays an article", () => {
  const r = parseHtml(
    page(jsonLd({ "@type": "Recipe", recipeIngredient: "1 loaf", recipeInstructions: "Mix.\nShape.\n\nBake.", recipeYield: 8 })),
    "https://bread.example/loaf"
  );
  assert.equal(r.contentType, "recipe");
  assert.deepEqual(r.templateData?.steps, ["Mix.", "Shape.", "Bake."]);
  assert.deepEqual(r.templateData?.ingredients, ["1 loaf"]);
  assert.equal(r.templateData?.yield, "8");
  assert.equal(parseHtml(page(""), "https://blog.example/post").contentType, "article");
});

test("ISO 8601 durations come out in whole seconds", () => {
  assert.equal(isoDurationSeconds("PT1H30M"), 5400);
  assert.equal(isoDurationSeconds("PT90M"), 5400);
  assert.equal(isoDurationSeconds("pt4m13s"), 253);
  assert.equal(isoDurationSeconds("P0DT0H35M"), 2100);
  assert.equal(isoDurationSeconds("P0Y0M0DT0H35M0.000S"), 2100);
  assert.equal(isoDurationSeconds("PT1.5H"), 5400);
  assert.equal(isoDurationSeconds("PT2.4S"), 2);
  assert.equal(isoDurationSeconds("P1D"), 86_400);
  assert.equal(isoDurationSeconds("PT0S"), 0);
  for (const bad of ["", "P", "PT", "15 minutes", "PT1.2.3M", undefined, 90]) {
    assert.equal(isoDurationSeconds(bad), undefined, String(bad));
  }
});

test("YouTube and Vimeo ids from every URL shape", () => {
  const yt = (url: string) => videoFromUrl(url)?.videoId;
  assert.equal(yt("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s"), "dQw4w9WgXcQ");
  assert.equal(yt("https://m.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(yt("https://youtu.be/dQw4w9WgXcQ?si=abc"), "dQw4w9WgXcQ");
  assert.equal(yt("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(yt("https://www.youtube.com/embed/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(yt("https://www.youtube.com/live/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(yt("https://www.youtube.com/@channel"), undefined);
  assert.equal(yt('https://www.youtube.com/watch?v=x"><script>'), undefined);
  assert.deepEqual(videoFromUrl("https://vimeo.com/76979871"), { provider: "vimeo", videoId: "76979871" });
  assert.equal(videoFromUrl("https://vimeo.com/channels/staffpicks/76979871")?.videoId, "76979871");
  assert.equal(videoFromUrl("https://vimeo.com/showcase/123/video/76979871")?.videoId, "76979871");
  assert.equal(videoFromUrl("https://player.vimeo.com/video/76979871?h=abc")?.videoId, "76979871");
  assert.equal(videoFromUrl("https://vimeo.com/about"), undefined);
  assert.equal(videoFromUrl("not a url"), undefined);
  assert.equal(videoEmbedUrl({ provider: "youtube", videoId: "dQw4w9WgXcQ" }), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  assert.equal(videoEmbedUrl({ provider: "vimeo", videoId: "76979871" }), "https://player.vimeo.com/video/76979871?dnt=1");
  assert.equal(videoEmbedUrl({ provider: "ted.com", videoId: "talk" }), undefined);
  assert.equal(videoEmbedUrl({ provider: "youtube", videoId: "a/../b" }), undefined);
});

test("a YouTube page gives the player id, channel and duration without calling oEmbed", () => {
  const html = page(
    `<meta property="og:type" content="video.other"><meta itemprop="duration" content="PT2H1M2S">`,
    `<span itemprop="author" itemscope><link itemprop="name" content="Systems Live"></span><p>${filler}</p>`
  );
  const t = parseHtml(html, "https://www.youtube.com/watch?v=dQw4w9WgXcQ").templateData;
  assert.deepEqual(
    { provider: t?.provider, videoId: t?.videoId, channel: t?.channel, durationSeconds: t?.durationSeconds },
    { provider: "youtube", videoId: "dQw4w9WgXcQ", channel: "Systems Live", durationSeconds: 7262 }
  );
});

test("a VideoObject on another site: its embed plays, its author is the channel", () => {
  const r = parseHtml(
    page(jsonLd({
      "@type": "VideoObject",
      name: "Talk",
      author: { "@type": "Person", name: "Ann Lee" },
      duration: "PT4M13S",
      embedUrl: "https://player.vimeo.com/video/76979871",
    })),
    "https://conf.example/talks/1"
  );
  assert.equal(r.contentType, "video");
  assert.equal(r.templateData?.provider, "vimeo");
  assert.equal(r.templateData?.videoId, "76979871");
  assert.equal(r.templateData?.channel, "Ann Lee");
  assert.equal(r.templateData?.durationSeconds, 253);
});

test("an article keeps Readability's byline and date", () => {
  const r = parseHtml(
    page(`<meta name="author" content="By Jane Doe"><meta property="article:published_time" content="2026-10-02T08:14:00+02:00">`),
    "https://blog.example/post"
  );
  assert.equal(r.contentType, "article");
  assert.deepEqual(r.templateData, { author: "Jane Doe", publishedAt: "2026-10-02T06:14:00.000Z" });
  const undated = parseHtml(page(`<meta property="article:published_time" content="soon">`), "https://blog.example/b");
  assert.equal(undated.templateData, undefined);
});
