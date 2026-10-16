// The jam gallery: many entry ZIPs in, one static site out. index.html is a
// grid of every entry (screenshot, clip on request, title, credits, play
// button) and each entry keeps its own offline player page. Nothing is
// fetched, so the folder works from a disk, itch.io or GitHub Pages.

import { strToU8, zipSync } from "fflate";
import { slugify } from "../files/exports.ts";
import type { ReadEntry } from "./entry.ts";

const MTIME = new Date("2026-01-01T00:00:00Z");

export interface GalleryInfo {
  name: string;
  theme?: string;
  dates?: string;
  constraints?: string[];
  link?: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Gives every entry its own folder name, in title order. */
export function galleryEntries(entries: ReadEntry[]): { slug: string; read: ReadEntry }[] {
  const sorted = [...entries].sort((a, b) => a.entry.title.localeCompare(b.entry.title, "en", { sensitivity: "base" }));
  const used = new Set<string>();
  return sorted.map((read) => {
    const base = slugify(read.entry.title);
    let slug = base;
    for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
    used.add(slug);
    return { slug, read };
  });
}

/** The entry's player page, with a way back to the gallery. */
export function withBackLink(playerHtml: string): string {
  const nav =
    `<style>.gallery-back{align-self:flex-start;color:#f0a23a;font-size:15px}details a{color:#f0a23a}</style>` +
    `<a class="gallery-back" href="../../index.html">&larr; All entries</a>`;
  return playerHtml.replace(/<body>/, (m) => `${m}\n${nav}`);
}

const CSS = `
:root { --bg: #14161b; --panel: #1d2027; --line: #353b47; --text: #e6e8ec; --muted: #a3aab6; --accent: #f0a23a; color-scheme: dark; }
* { box-sizing: border-box; }
html { background: var(--bg); }
body { margin: 0; color: var(--text); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
a { color: var(--accent); }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
.skip { position: absolute; left: 16px; top: -60px; background: var(--accent); color: #1a1205; padding: 8px 14px; border-radius: 6px; font-weight: 700; }
.skip:focus { top: 12px; }
header { padding: 48px 16px 28px; text-align: center; background: radial-gradient(ellipse at top, #2a2214 0%, var(--bg) 70%); border-bottom: 1px solid var(--line); }
.kicker { margin: 0; color: var(--accent); font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; font-size: 13px; }
h1 { margin: 6px 0 8px; font-size: clamp(30px, 6vw, 56px); line-height: 1.1; letter-spacing: 0.01em; }
.theme { margin: 0; font-size: clamp(18px, 3vw, 24px); }
.theme strong { color: var(--accent); }
.dates { color: var(--muted); margin: 6px 0 0; }
.rules { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; list-style: none; padding: 0; margin: 16px 0 0; }
.rules li { border: 1px solid var(--line); border-radius: 999px; padding: 3px 12px; font-size: 14px; color: var(--text); background: var(--panel); }
main { max-width: 1200px; margin: 0 auto; padding: 28px 16px 48px; }
.count { margin: 0 0 18px; color: var(--muted); font-size: 15px; font-weight: 400; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; list-style: none; margin: 0; padding: 0; }
.card { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; height: 100%; }
.shot { position: relative; aspect-ratio: 4 / 3; background: #000; display: grid; place-items: center; }
.shot img { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; display: block; }
.shot .none { color: var(--muted); font-size: 44px; font-weight: 800; }
.body { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 6px; flex: 1; }
.card h2 { margin: 0; font-size: 20px; line-height: 1.25; }
.by { margin: 0; color: var(--muted); font-size: 14px; }
.desc { margin: 4px 0 0; font-size: 15px; }
.controls { margin: 0; color: var(--muted); font-size: 13px; }
.actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: auto; padding-top: 10px; }
.play { background: var(--accent); color: #1a1205; text-decoration: none; font-weight: 700; padding: 9px 18px; border-radius: 999px; }
.play:hover { background: #ffb85a; }
.clip { background: #2c313b; color: var(--text); border: 1px solid var(--line); border-radius: 999px; padding: 8px 14px; font: inherit; font-size: 14px; cursor: pointer; }
.clip[aria-pressed="true"] { border-color: var(--accent); }
.rom { font-size: 14px; }
footer { border-top: 1px solid var(--line); padding: 20px 16px 32px; text-align: center; color: var(--muted); font-size: 14px; }
footer p { margin: 4px 0; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

/** Clips are still screenshots until asked for (moving pictures need a pause button, WCAG 2.2.2). */
const SCRIPT = `
document.querySelectorAll("button.clip").forEach(function (b) {
  b.hidden = false;
  var img = document.getElementById(b.getAttribute("aria-controls"));
  var still = img.getAttribute("src"), stillAlt = img.getAttribute("alt");
  b.addEventListener("click", function () {
    var on = b.getAttribute("aria-pressed") !== "true";
    b.setAttribute("aria-pressed", String(on));
    b.textContent = on ? "Stop clip" : "Watch clip";
    img.setAttribute("src", on ? b.dataset.clip : still);
    img.setAttribute("alt", on ? b.dataset.alt : stillAlt);
  });
});
`;

function card({ slug, read }: { slug: string; read: ReadEntry }, i: number): string {
  const e = read.entry;
  const t = esc(e.title);
  const dir = `entries/${slug}`;
  const shotId = `shot-${i}`;
  const hasShot = !!read.files.thumbnail;
  const shot = hasShot
    ? `<img id="${shotId}" src="${dir}/thumbnail.png" alt="Screenshot of ${t}" width="320" height="240">`
    : read.files.clip
      ? `<img id="${shotId}" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="" width="320" height="240">`
      : `<span class="none" aria-hidden="true">${esc(e.title.slice(0, 1).toUpperCase())}</span>`;
  const clip = read.files.clip
    ? `<button type="button" class="clip" hidden aria-pressed="false" aria-controls="${shotId}" data-clip="${dir}/clip.gif" data-alt="${esc(`Clip of ${e.title} being played`)}">Watch clip</button>`
    : "";
  return `<li>
<article class="card" aria-labelledby="t-${i}">
  <div class="shot">${shot}</div>
  <div class="body">
    <h2 id="t-${i}">${t}</h2>
    ${e.credits ? `<p class="by">By ${esc(e.credits)}</p>` : ""}
    ${e.description ? `<p class="desc">${esc(e.description)}</p>` : ""}
    ${e.controls ? `<p class="controls"><span class="visually-hidden">Controls: </span>${esc(e.controls)}</p>` : ""}
    <div class="actions">
      <a class="play" href="${dir}/play.html">Play<span class="visually-hidden"> ${t}</span></a>
      ${clip}
      <a class="rom" href="${dir}/${esc(read.entry.files.a78)}" download>ROM<span class="visually-hidden"> of ${t}</span> (.a78)</a>
    </div>
  </div>
</article>
</li>`;
}

export function galleryIndexHtml(info: GalleryInfo, entries: { slug: string; read: ReadEntry }[]): string {
  const name = esc(info.name.trim() || "Game jam");
  const rules = (info.constraints ?? []).filter((c) => c.trim());
  const n = entries.length;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name}: the entries</title>
<meta name="description" content="${n} games made for ${name}${info.theme ? `, on the theme ${esc(info.theme)}` : ""}.">
<style>${CSS}.visually-hidden { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }</style>
</head>
<body>
<a class="skip" href="#entries">Skip to the games</a>
<header>
  <p class="kicker">Game jam</p>
  <h1>${name}</h1>
  ${info.theme ? `<p class="theme">Theme: <strong>${esc(info.theme)}</strong></p>` : ""}
  ${info.dates ? `<p class="dates">${esc(info.dates)}</p>` : ""}
  ${rules.length ? `<ul class="rules" aria-label="Rules">${rules.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
  ${info.link ? `<p><a href="${esc(info.link)}">About the jam</a></p>` : ""}
</header>
<main id="entries" tabindex="-1">
  <p class="count">${n} ${n === 1 ? "game" : "games"}, in title order. Every one plays in this browser, with a keyboard or a gamepad.</p>
  <ul class="grid">
${entries.map(card).join("\n")}
  </ul>
</main>
<footer>
  <p>Each game is also a 7800 ROM: it plays in 7800 emulators and, with a flash cartridge, on a 7800+, 2600+ or 7800.</p>
  <p>Made with Cartridge Studio. Not affiliated with or endorsed by Atari.</p>
</footer>
<script>${SCRIPT}</script>
</body>
</html>
`;
}

export function galleryZip(info: GalleryInfo, entries: ReadEntry[]): Uint8Array {
  if (entries.length === 0) throw new Error("Add at least one entry first.");
  const list = galleryEntries(entries);
  // index.html at the top, as itch.io's HTML projects want.
  const files: Record<string, Uint8Array> = {
    "index.html": strToU8(galleryIndexHtml(info, list)),
  };
  for (const { slug, read } of list) {
    const dir = `entries/${slug}`;
    const f = read.files;
    files[`${dir}/play.html`] = strToU8(withBackLink(new TextDecoder().decode(f.player)));
    files[`${dir}/${read.entry.files.a78}`] = f.a78;
    files[`${dir}/${read.entry.files.bin}`] = f.bin;
    files[`${dir}/${read.entry.files.cartridge}`] = f.cartridge;
    if (f.clip) files[`${dir}/clip.gif`] = f.clip;
    if (f.thumbnail) files[`${dir}/thumbnail.png`] = f.thumbnail;
  }
  return zipSync(files, { level: 6, mtime: MTIME });
}

/** The jam's details as the entries tell them, when there's no brief to hand. */
export function infoFromEntries(entries: ReadEntry[]): GalleryInfo {
  const first = entries[0]?.entry.jam;
  return { name: first?.name ?? "Game jam", theme: first?.theme ?? "" };
}
