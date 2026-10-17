import Image from "next/image";
import villa from "../../public/images/demo/villa.webp";
import sneakers from "../../public/images/demo/sneakers.webp";
import coffee from "../../public/images/demo/coffee.webp";
import office from "../../public/images/demo/office.webp";
import kyoto from "../../public/images/demo/kyoto.webp";
import bcnSunset from "../../public/images/demo/bcn-sunset.webp";
import bcnSkyline from "../../public/images/demo/bcn-skyline.webp";
import bcnGuell from "../../public/images/demo/bcn-guell.webp";
import colReading from "../../public/images/collections/reading.webp";

/** Landing "AnyLink for iPhone": five static iPhone screens on a slow 3D arc. Values come
 *  straight from the design mock (design/AnyLink — landing-html). */

const EDGES = Array.from({ length: 10 }, (_, i) => <i key={i} className="ph-e" />);

export function PhoneArc() {
  return (
    <div
      className="arc-stage"
      role="img"
      aria-label="Five iPhone screens of AnyLink: the share sheet, Sort Unsorted, the library, the reader and a shared collection"
    >
      <div className="arc-floor" aria-hidden />
      <div className="arc-scale">
        <div className="arc">
          <div className="ph ph-1">
          {EDGES}
          <div className="ph-face"><div className="scr light" style={{ background: "#fff" }}>
          <span className="p-island" />
          <div className="p-pic" style={{ position: "absolute", left: "0", right: "0", top: "0", height: "330px", borderRadius: "0" }}><Image sizes="240px" src={bcnGuell} alt="" /></div>
          <div style={{ position: "absolute", top: "350px", left: "22px", right: "22px", font: "700 27px/1.15 Georgia, serif", letterSpacing: "-.4px" }}>Park Güell without the queues</div>
          <div style={{ position: "absolute", top: "430px", left: "22px", right: "22px", display: "grid", gap: "11px" }}><i style={{ height: "10px", borderRadius: "5px", background: "#e6e7ea" }} /><i style={{ height: "10px", borderRadius: "5px", background: "#e6e7ea" }} /><i style={{ height: "10px", width: "70%", borderRadius: "5px", background: "#e6e7ea" }} /></div>
          <div style={{ position: "absolute", inset: "0", zIndex: "30", background: "rgba(0,0,0,.28)" }} />
          <div className="p-sheet" style={{ top: "300px", padding: "0 20px" }}>
          <div className="p-grab" />
          <div style={{ width: "48px", height: "48px", margin: "22px auto 0", borderRadius: "24px", background: "#d6f24b", display: "grid", placeItems: "center", fontSize: "24px" }}><svg className="ic" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></div>
          <div style={{ marginTop: "14px", textAlign: "center", font: "600 22px var(--sans)", letterSpacing: "-.66px" }}>Saved to Travel</div>
          <div style={{ marginTop: "4px", textAlign: "center", font: "400 14.5px/1.5 var(--sans)", color: "rgba(23,24,27,.55)" }}>You can close this — it’s already in your library.</div>
          <div className="p-frost" style={{ marginTop: "20px", padding: "12px", borderRadius: "20px", display: "flex", gap: "12px", alignItems: "center" }}>
          <div className="p-thumb" style={{ width: "52px", height: "52px", borderRadius: "13px" }}><Image sizes="240px" src={bcnGuell} alt="" /></div>
          <div className="p-rx"><div className="p-src"><span className="p-bdg" style={{ background: "#7c8cff", color: "#fff" }}>C</span>citywalks.guide</div><div className="p-rt" style={{ marginTop: "3px", fontSize: "15px" }}>Park Güell without the queues</div></div>
          </div>
          <div style={{ margin: "12px 4px 0", display: "flex", gap: "6px", alignItems: "center", font: "500 13px var(--sf)", color: "rgba(23,24,27,.6)" }}><svg className="ic" viewBox="0 0 24 24" style={{ color: "#00a046" }}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>Summary and tags added</div>
          <div className="p-eb" style={{ margin: "22px 4px 10px" }}>Move to</div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}><span className="p-chip on"><span className="p-dot" style={{ background: "#d6f24b" }} />Travel</span><span className="p-chip"><span className="p-dot" style={{ background: "#7c8cff" }} />Barcelona weekend</span><span className="p-chip"><span className="p-dot" style={{ background: "#fb5607" }} />Reading</span></div>
          <div className="p-field" style={{ marginTop: "18px" }}>Add a note (optional)</div>
          <div className="p-btn" style={{ marginTop: "14px", background: "#17181b", color: "#fff" }}>Done</div>
          </div>
          </div></div>
          <div className="ph-cap"><b>Share sheet</b><span>Saved before it closes</span></div>
          </div>

          <div className="ph ph-2">
          {EDGES}
          <div className="ph-face"><div className="scr light">
          <span className="p-orb" style={{ left: "-90px", top: "-60px", width: "320px", height: "320px", background: "#9aa3ad", opacity: ".42" }} />
          <span className="p-orb" style={{ right: "-100px", top: "300px", width: "320px", height: "320px", background: "#fb5607", opacity: ".24", filter: "blur(110px)" }} />
          <span className="p-island" />
          <div className="p-circ p-glass" style={{ left: "16px" }}><svg className="ic" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></svg></div>
          <div style={{ position: "absolute", top: "58px", left: "0", right: "0", textAlign: "center" }}><div style={{ font: "600 17px var(--sf)" }}>Sort Unsorted</div><div style={{ font: "400 12px var(--sf)", color: "rgba(23,24,27,.5)" }}>3 of 7</div></div>
          <div className="p-glass" style={{ position: "absolute", top: "56px", right: "16px", height: "44px", padding: "0 16px", borderRadius: "22px", font: "600 15px/42px var(--sf)" }}>Done</div>
          <div style={{ position: "absolute", top: "114px", left: "20px", right: "20px", height: "4px", borderRadius: "2px", background: "rgba(23,24,27,.08)" }}><div style={{ width: "43%", height: "100%", borderRadius: "2px", background: "#d6f24b", boxShadow: "0 0 0 .5px rgba(23,24,27,.1)" }} /></div>
          <div style={{ position: "absolute", top: "134px", left: "0", right: "0", textAlign: "center" }}><span style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "32px", padding: "0 14px", borderRadius: "16px", background: "rgba(124,140,255,.18)", font: "500 13.5px var(--sans)" }}><svg className="ic fill" viewBox="0 0 24 24" style={{ color: "#4a58d6" }}><path d="M12 2.5l2 6.5 6.5 2-6.5 2-2 6.5-2-6.5-6.5-2 6.5-2z" /></svg>Looks like <b style={{ fontWeight: "600" }}>Reading</b></span></div>
          <div className="p-frost" style={{ position: "absolute", top: "186px", left: "30px", width: "342px", height: "380px", borderRadius: "26px", transform: "rotate(-3deg) scale(.95)", background: "rgba(255,255,255,.7)" }}><div className="p-pic" style={{ margin: "8px", height: "170px", borderRadius: "19px" }}><Image sizes="240px" src={office} alt="" /></div></div>
          <div className="p-frost" style={{ position: "absolute", top: "200px", left: "52px", width: "316px", borderRadius: "24px", padding: "7px", transform: "rotate(9deg)", transformOrigin: "20% 100%", background: "rgba(255,255,255,.97)", boxShadow: "0 40px 50px -22px rgba(0,0,0,.45)" }}>
          <div className="p-pic p-shade" style={{ height: "150px", borderRadius: "18px" }}><Image sizes="240px" src={colReading} alt="" /></div>
          <div style={{ position: "absolute", top: "26px", left: "22px", transform: "rotate(-12deg)", padding: "3px 10px", border: "3px solid #fb5607", borderRadius: "10px", background: "rgba(255,255,255,.82)", color: "#fb5607", font: "700 24px var(--sans)", letterSpacing: "1px" }}>READING</div>
          <div style={{ padding: "12px 9px 9px" }}><div className="p-src"><span className="p-bdg" style={{ background: "#fb5607", color: "#fff" }}>M</span>marginalia.blog · 8 min read</div><div style={{ marginTop: "7px", font: "600 18px/1.2 var(--sans)", letterSpacing: "-.68px" }}>How to read 50 books a year without really trying</div><div style={{ display: "flex", gap: "6px", marginTop: "10px" }}><span className="p-chip" style={{ height: "26px", padding: "0 10px", fontSize: "12px" }}>#books</span><span className="p-chip" style={{ height: "26px", padding: "0 10px", fontSize: "12px" }}>#habits</span></div></div>
          </div>
          <div style={{ position: "absolute", top: "604px", left: "20px", right: "20px", display: "flex", gap: "8px", alignItems: "center" }}><span style={{ font: "500 13px var(--sf)", color: "rgba(23,24,27,.5)", paddingRight: "4px" }}>Or:</span><span className="p-chip"><span className="p-dot" style={{ background: "#e0855a" }} />Inspiration</span><span className="p-chip"><span className="p-dot" style={{ background: "#d6f24b" }} />Travel</span><span className="p-chip"><span className="p-dot" style={{ background: "#17181b" }} />Watch later</span></div>
          <div style={{ position: "absolute", top: "656px", left: "20px", right: "20px", display: "flex", gap: "10px" }}>
          <span style={{ flex: "none", width: "60px", height: "60px", borderRadius: "30px", display: "grid", placeItems: "center", background: "#17181b", color: "#fff", fontSize: "22px" }}><svg className="ic" viewBox="0 0 24 24"><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5" /></svg></span>
          <span className="p-glass p-btn" style={{ height: "60px", padding: "0 22px", borderRadius: "30px", fontFamily: "var(--sf)" }}>Later</span>
          <span className="p-acc p-btn" style={{ flex: "1", height: "60px", borderRadius: "30px", fontSize: "16px" }}>Reading <svg className="ic" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span>
          </div>
          </div></div>
          <div className="ph-cap"><b>Sort Unsorted</b><span>Swipe right to file it</span></div>
          </div>

          <div className="ph ph-3">
          {EDGES}
          <div className="ph-face"><div className="scr light">
          <span className="p-orb" style={{ left: "-90px", top: "-60px", width: "300px", height: "300px", background: "#fb5607", opacity: ".3" }} />
          <span className="p-orb" style={{ right: "-80px", top: "340px", width: "280px", height: "280px", background: "#7c8cff", opacity: ".26", filter: "blur(100px)" }} />
          <span className="p-island" />
          <div className="p-navcap p-glass"><span className="p-ib on"><svg className="ic" viewBox="0 0 24 24"><rect x="4" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" /></svg></span><span className="p-ib"><svg className="ic" viewBox="0 0 24 24"><path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" /></svg></span><span className="p-ib"><svg className="ic" viewBox="0 0 24 24"><path d="M7.5 4.5v15M4 8l3.5-3.5L11 8M16.5 19.5v-15M13 16l3.5 3.5L20 16" /></svg></span></div>
          <div className="p-ct" style={{ top: "106px" }}>
          <div className="p-lt">Library</div>
          <div className="p-chips" style={{ marginTop: "12px" }}><span className="p-chip on">All <em>128</em></span><span className="p-chip">Unsorted <em>7</em></span><span className="p-chip">Favorites <em>23</em></span><span className="p-chip">Videos <em>11</em></span><span className="p-chip">Products <em>9</em></span></div>
          <div className="p-frost" style={{ margin: "12px 14px", padding: "8px 8px 8px 14px", borderRadius: "18px", display: "flex", alignItems: "center", gap: "12px" }}>
          <span className="p-dot" style={{ width: "10px", height: "10px", background: "#9aa3ad" }} />
          <div style={{ flex: "1" }}><div style={{ font: "600 14px var(--sans)", letterSpacing: "-.2px" }}>7 links in Unsorted</div><div className="p-rm">Sort them in about a minute</div></div>
          <span className="p-btn" style={{ height: "40px", padding: "0 18px", background: "#17181b", color: "#fff", fontSize: "13.5px" }}>Sort</span>
          </div>
          <div className="p-tiles">
          <div className="p-tile p-frost"><div className="p-pic p-shade"><Image sizes="240px" src={kyoto} alt="" /></div><div className="p-bd"><div className="p-src"><span className="p-bdg" style={{ background: "#d6f24b", color: "#17181b" }}>S</span>slowtravel.co<svg className="ic fill p-star" viewBox="0 0 24 24"><path d="M12 3.2l2.7 5.5 6 .9-4.35 4.25 1.03 6-5.38-2.83-5.38 2.83 1.03-6L3.3 9.6l6-.9z" /></svg></div><div className="p-tt">Kyoto in 48 hours, without the crowds</div><div className="p-meta">9 min read</div></div></div>
          <div className="p-tile p-frost"><div className="p-pic"><Image sizes="240px" src={sneakers} alt="" /></div><div className="p-bd"><div className="p-src"><span className="p-bdg" style={{ background: "#17181b", color: "#fff" }}>H</span>halden.com</div><div className="p-tt">Arc Runner 3 — Everyday Trainer</div><div className="p-meta price">$104.99</div></div></div>
          <div className="p-tile p-frost"><div className="p-pic p-shade"><Image sizes="240px" src={villa} alt="" /></div><div className="p-bd"><div className="p-src"><span className="p-bdg" style={{ background: "#7c8cff", color: "#fff" }}>S</span>staysmag.com</div><div className="p-tt">The dreamiest hotels in Portugal</div><div className="p-meta">6 min read</div></div></div>
          <div className="p-tile p-frost"><div className="p-pic p-shade"><Image sizes="240px" src={bcnSunset} alt="" /><span className="p-play"><svg className="ic fill" viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" /></svg></span></div><div className="p-bd"><div className="p-src"><span className="p-bdg" style={{ background: "#fb5607", color: "#fff" }}>L</span>lensday.tv<svg className="ic fill p-star" viewBox="0 0 24 24"><path d="M12 3.2l2.7 5.5 6 .9-4.35 4.25 1.03 6-5.38-2.83-5.38 2.83 1.03-6L3.3 9.6l6-.9z" /></svg></div><div className="p-tt">A weekend in Barcelona, shot on film</div><div className="p-meta">▶ 18:42</div></div></div>
          <div className="p-tile p-frost"><div className="p-pic p-shade"><Image sizes="240px" src={coffee} alt="" /></div><div className="p-bd"><div className="p-src"><span className="p-bdg" style={{ background: "#e0855a", color: "#fff" }}>B</span>brewguide.co</div><div className="p-tt">Good coffee at home, step by step</div><div className="p-meta">7 min read</div></div></div>
          <div className="p-tile p-frost"><div className="p-pic p-fb"></div><div className="p-bd"><div className="p-src"><span className="p-bdg" style={{ background: "#17181b", color: "#d6f24b" }}>A</span>async.dev</div><div className="p-tt">Notes on structured concurrency</div><div className="p-meta">12 min read</div></div></div>
          </div>
          </div>
          <div className="p-accy p-glass"><svg className="ic" viewBox="0 0 24 24"><path d="M10 13.5a4.5 4.5 0 0 0 6.4.4l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.6 1.6" /><path d="M14 10.5a4.5 4.5 0 0 0-6.4-.4l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.6-1.6" /></svg><div className="p-ax">Link on your clipboard<span>Paste to save it</span></div><span className="p-paste p-acc">Paste</span></div>
          <div className="p-tabbar"><div className="p-tabs p-glass"><div className="p-tab on"><svg className="ic" viewBox="0 0 24 24"><path d="M10 13.5a4.5 4.5 0 0 0 6.4.4l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.6 1.6" /><path d="M14 10.5a4.5 4.5 0 0 0-6.4-.4l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.6-1.6" /></svg>Library</div><div className="p-tab"><svg className="ic" viewBox="0 0 24 24"><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" /></svg>Collections</div></div><div className="p-tabsearch p-glass"><svg className="ic" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg></div></div>
          </div></div>
          <div className="ph-cap"><b>Library</b><span>Everything you kept, at a glance</span></div>
          </div>

          <div className="ph ph-4">
          {EDGES}
          <div className="ph-face"><div className="scr light" style={{ background: "#f4f5f6" }}>
          <span className="p-orb" style={{ right: "-150px", bottom: "-180px", width: "520px", height: "520px", background: "#7c8cff", opacity: ".24", filter: "blur(140px)" }} />
          <span className="p-island" />
          <div className="p-pic" style={{ position: "absolute", left: "0", right: "0", top: "0", height: "400px", borderRadius: "0" }}><Image sizes="240px" src={villa} alt="" />
          <div style={{ position: "absolute", inset: "0", background: "linear-gradient(to top,rgba(0,0,0,.8),rgba(0,0,0,.35) 45%,rgba(0,0,0,0) 75%),linear-gradient(to bottom,rgba(0,0,0,.35),rgba(0,0,0,0) 24%)" }} />
          <div style={{ position: "absolute", left: "24px", right: "24px", bottom: "26px", color: "#fff" }}><div className="p-eb" style={{ color: "rgba(255,255,255,.88)" }}>staysmag.com · 6 min read</div><div style={{ marginTop: "8px", font: "600 30px/1.1 var(--sans)", letterSpacing: "-1.2px", textShadow: "0 1px 3px rgba(0,0,0,.5)" }}>The dreamiest hotels in Portugal</div></div>
          </div>
          <div className="p-circ p-glass p-dark" style={{ left: "16px", top: "62px" }}><svg className="ic" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></svg></div>
          <div className="p-glass p-dark" style={{ position: "absolute", zIndex: "20", top: "62px", right: "16px", height: "44px", padding: "0 4px", borderRadius: "22px", display: "flex", alignItems: "center", fontSize: "19px" }}><span className="p-ib" style={{ color: "#fb5607" }}><svg className="ic fill" viewBox="0 0 24 24"><path d="M12 3.2l2.7 5.5 6 .9-4.35 4.25 1.03 6-5.38-2.83-5.38 2.83 1.03-6L3.3 9.6l6-.9z" /></svg></span><span className="p-ib"><svg className="ic" viewBox="0 0 24 24"><path d="M5.5 12h.01M12 12h.01M18.5 12h.01" style={{ strokeWidth: "3.4" }} /></svg></span></div>
          <div className="p-ct" style={{ top: "418px", padding: "0 24px" }}>
          <div style={{ display: "flex", gap: "7px", alignItems: "center" }}><span className="p-chip" style={{ height: "30px", padding: "0 11px" }}><span className="p-dot" style={{ background: "#d6f24b" }} />Travel</span><span className="p-chip" style={{ height: "30px", padding: "0 11px" }}>#portugal</span><span className="p-chip" style={{ height: "30px", padding: "0 11px" }}>#hotels</span><span className="p-rm" style={{ margin: "0 0 0 4px" }}>Saved Oct 12</span></div>
          <div style={{ marginTop: "16px", padding: "12px 14px", borderRadius: "14px", background: "rgba(214,242,75,.32)", display: "flex", gap: "10px", font: "400 14px/1.45 var(--sans)" }}><svg className="ic" viewBox="0 0 24 24" style={{ marginTop: "2px", opacity: ".6" }}><path d="M4.5 19.5h4l10.5-10.5-4-4L4.5 15.5z" /><path d="M13.5 6.5l4 4" /></svg>Ask about the off-season rate for the pool suite.</div>
          <p style={{ margin: "18px 0 0", font: "400 17px/1.65 var(--sans)", color: "rgba(23,24,27,.85)" }}>The best hotels in Portugal don’t announce themselves. They sit at the end of cork-oak lanes and behind whitewashed walls, and they assume you came for the quiet. <mark style={{ background: "rgba(214,242,75,.6)" }}>Book the Alentejo first; the coast can wait a night.</mark></p>
          </div>
          <div style={{ position: "absolute", zIndex: "30", left: "16px", right: "16px", bottom: "26px", display: "flex", gap: "10px" }}>
          <span className="p-glass" style={{ flex: "1", height: "56px", borderRadius: "28px", display: "flex", alignItems: "center", justifyContent: "space-around", fontSize: "20px" }}><svg className="ic" viewBox="0 0 24 24"><path d="M4.5 19.5h4l10.5-10.5-4-4L4.5 15.5z" /><path d="M13.5 6.5l4 4" /></svg><svg className="ic" viewBox="0 0 24 24"><path d="M14.5 4.5l5 5-7.5 7.5h-5v-5z" /><path d="M7 17l-3 3h6" /></svg><svg className="ic" viewBox="0 0 24 24"><path d="M12 3.5v11M8 7.5l4-4 4 4M6 11v8a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19v-8" /></svg></span>
          <span className="p-acc p-btn" style={{ height: "56px", padding: "0 26px", borderRadius: "28px" }}>Open <svg className="ic" viewBox="0 0 24 24"><path d="M7 17L17 7M8.5 7H17v8.5" /></svg></span>
          </div>
          </div></div>
          <div className="ph-cap"><b>Reader</b><span>Just the article, with your notes</span></div>
          </div>

          <div className="ph ph-5">
          {EDGES}
          <div className="ph-face"><div className="scr light">
          <span className="p-orb" style={{ left: "-90px", top: "-60px", width: "320px", height: "320px", background: "#7c8cff", opacity: ".32" }} />
          <span className="p-orb" style={{ right: "-80px", top: "240px", width: "280px", height: "280px", background: "#fb5607", opacity: ".26", filter: "blur(100px)" }} />
          <span className="p-island" />
          <div className="p-circ p-glass" style={{ left: "16px" }}><svg className="ic" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></svg></div>
          <div className="p-ct" style={{ top: "110px" }}>
          <div className="p-lt" style={{ display: "flex", alignItems: "center", gap: "10px" }}><span className="p-dot" style={{ width: "12px", height: "12px", background: "#7c8cff" }} />Barcelona weekend</div>
          <div className="p-rm" style={{ padding: "4px 20px 0", fontSize: "12.5px" }}>12 links · shared</div>
          <div className="p-tiles" style={{ marginTop: "14px" }}><div className="p-tile p-frost"><div className="p-pic p-shade"><Image sizes="240px" src={bcnGuell} alt="" /></div></div><div className="p-tile p-frost"><div className="p-pic p-shade"><Image sizes="240px" src={bcnSkyline} alt="" /></div></div></div>
          </div>
          <div style={{ position: "absolute", inset: "0", zIndex: "35", background: "rgba(0,0,0,.2)" }} />
          <div className="p-sheet" style={{ top: "300px", padding: "0 16px" }}>
          <div className="p-grab" />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0 0" }}><span style={{ width: "40px" }} /><span style={{ font: "600 17px var(--sf)" }}>Share “Barcelona weekend”</span><span className="p-acc" style={{ width: "40px", height: "40px", borderRadius: "20px", display: "grid", placeItems: "center", fontSize: "18px" }}><svg className="ic" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span></div>
          <div style={{ marginTop: "20px", height: "54px", padding: "0 16px", borderRadius: "24px", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", font: "400 17px var(--sf)" }}>Anyone with the link can view<span style={{ position: "relative", flex: "none", width: "62px", height: "28px", borderRadius: "14px", background: "#34c759" }}><span style={{ position: "absolute", right: "2px", top: "2px", width: "38px", height: "24px", borderRadius: "12px", background: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,.2)" }} /></span></div>
          <div style={{ padding: "8px 16px 0", font: "400 13px/1.4 var(--sf)", color: "rgba(23,24,27,.55)" }}>Viewers see each link, its price, and your notes on it — not your tags or highlights. They can save copies to their own AnyLink.</div>
          <div style={{ marginTop: "18px", borderRadius: "24px", overflow: "hidden", background: "#fff" }}>
          <div style={{ height: "52px", padding: "0 16px", display: "flex", alignItems: "center", gap: "10px", font: "400 17px var(--sf)", color: "#fb5607" }}><svg className="ic" viewBox="0 0 24 24"><path d="M12 3.5v11M8 7.5l4-4 4 4M6 11v8a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19v-8" /></svg>Share link…</div>
          <div style={{ height: "46px", padding: "0 16px", display: "flex", alignItems: "center", borderTop: "1px solid rgba(23,24,27,.07)", font: "400 12.5px var(--sans)", color: "rgba(23,24,27,.6)" }}>www.anylink.space/s/k3v9p2xq7m</div>
          </div>
          <div style={{ padding: "20px 16px 7px", font: "400 13px var(--sf)", color: "rgba(23,24,27,.55)" }}>Your name on it (optional)</div>
          <div style={{ height: "52px", padding: "0 16px", borderRadius: "24px", background: "#fff", display: "flex", alignItems: "center", font: "400 17px var(--sf)" }}>Marta</div>
          </div>
          </div></div>
          <div className="ph-cap"><b>Shared collections</b><span>One link, always up to date</span></div>
          </div>        </div>
      </div>
    </div>
  );
}
