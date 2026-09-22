import puppeteer from "puppeteer";

const manual = process.env.MANUAL === "1";
const dir = process.env.DIR || "grow"; // grow | shrink
const b = await puppeteer.launch({ headless: process.env.HEAD !== "1", slowMo: process.env.HEAD === "1" ? 30 : 0 });
const p = await b.newPage();
await p.setViewport({ width: Number(process.env.W || 1440), height: 900 });
p.on("pageerror", (e) => console.log("[pageerror]", e.message));
await p.goto(process.env.URL || "http://localhost:3000/app", { waitUntil: "networkidle0" });
if (manual) { await p.select("select", "manual"); await new Promise(r => setTimeout(r, 400)); }

const activeSize = () => p.evaluate(() => {
  const el = document.querySelector('[data-tour="card-size"]');
  return [...el.querySelectorAll("button")].find(b => b.style.background.includes("ink"))?.textContent;
});
const box = () => p.evaluate(() => {
  const r = document.querySelector('[data-tour="card"]').getBoundingClientRect();
  return { x: r.x, y: r.y, w: Math.round(r.width), h: Math.round(r.height) };
});

console.log("mode:", manual ? "manual-sort" : "default", "| dir:", dir, "| size before:", await activeSize(), await box());
await (await p.$('[data-tour="card"]')).hover();
const hb = await p.evaluate(() => {
  const r = document.querySelector('[data-tour="card"] [title="Drag to resize"]').getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await p.evaluate(() => { window.__ds = 0; addEventListener("dragstart", () => window.__ds++, true); });

const step = dir === "grow" ? 1 : -1;
await p.mouse.move(hb.x, hb.y);
await p.mouse.down();
for (let i = 1; i <= 25; i++) {
  await p.mouse.move(hb.x + step * i * 16, hb.y + step * i * 8);
  await new Promise(r => setTimeout(r, 16));
}
await p.mouse.up();
await new Promise(r => setTimeout(r, 700));
console.log("url now:", p.url(), "cards:", await p.$$eval('[data-tour="card"]', e=>e.length).catch(()=>-1));
console.log("dragstarts:", await p.evaluate(() => window.__ds), "| size after:", await activeSize(), await box(), "| url:", p.url());
await b.close();
