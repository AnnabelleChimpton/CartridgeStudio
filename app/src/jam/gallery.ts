// The jam gallery: entry packages in, one static site out. index.html is a
// grid of every entry (screenshot, clip on request, title, credits, play
// button). Every player page is made fresh here from the entry's ROM, sharing
// one copy of the emulator: nothing a creator wrote runs as code. Nothing is
// fetched, so the folder works from a disk, itch.io or GitHub Pages.
//
// Judging: judges.csv lists every entry with a column per criterion; filled-in
// copies come back and become results.html.

import { strToU8, zipSync } from "fflate";
import { slugify } from "../files/exports.ts";
import { licenceName, type ReadPackage } from "../files/package.ts";
import { playerHtml, playerSharedFiles, type PlayerAssets } from "../player/player.ts";

const MTIME = new Date("2026-01-01T00:00:00Z");

export interface GalleryInfo {
  name: string;
  theme?: string;
  dates?: string;
  constraints?: string[];
  criteria?: string[];
  link?: string;
}

export interface GalleryEntry {
  read: ReadPackage;
  /** What the organizer's checks found: limits, build, licence. */
  flags: string[];
}

export interface GalleryOptions {
  /** Leave out credits (and the game files, which can name their maker), for judging. */
  anonymous?: boolean;
  results?: Results | null;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export interface Listed extends GalleryEntry {
  /** The entry's folder, and its id in judges.csv. */
  slug: string;
}

/** Gives every entry its own folder name, in title order. */
export function galleryEntries(entries: GalleryEntry[]): Listed[] {
  const sorted = [...entries].sort((a, b) => a.read.manifest.title.localeCompare(b.read.manifest.title, "en", { sensitivity: "base" }));
  const used = new Set<string>();
  return sorted.map((e) => {
    const base = slugify(e.read.manifest.title);
    let slug = base;
    for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
    used.add(slug);
    return { ...e, slug };
  });
}

const CSS = `
:root { --bg: #14161b; --panel: #1d2027; --line: #353b47; --text: #e6e8ec; --muted: #a3aab6; --accent: #f0a23a; color-scheme: dark; }
* { box-sizing: border-box; }
html { background: var(--bg); }
body { margin: 0; color: var(--text); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
a { color: var(--accent); }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
.visually-hidden { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.skip { position: absolute; left: 16px; top: -60px; background: var(--accent); color: #1a1205; padding: 8px 14px; border-radius: 6px; font-weight: 700; }
.skip:focus { top: 12px; }
header { padding: 48px 16px 28px; text-align: center; background: radial-gradient(ellipse at top, #2a2214 0%, var(--bg) 70%); border-bottom: 1px solid var(--line); }
.kicker { margin: 0; color: var(--accent); font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; font-size: 13px; }
h1 { margin: 6px 0 8px; font-size: clamp(30px, 6vw, 56px); line-height: 1.1; letter-spacing: 0.01em; }
.theme { margin: 0; font-size: clamp(18px, 3vw, 24px); }
.theme strong { color: var(--accent); }
.dates { color: var(--muted); margin: 6px 0 0; }
.rules { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; list-style: none; padding: 0; margin: 16px 0 0; }
.rules li { border: 1px solid var(--line); border-radius: 999px; padding: 3px 12px; font-size: 14px; background: var(--panel); }
.links { display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; margin: 16px 0 0; }
main { max-width: 1200px; margin: 0 auto; padding: 28px 16px 48px; }
.count { margin: 0 0 18px; color: var(--muted); font-size: 15px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; list-style: none; margin: 0; padding: 0; }
.card { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; height: 100%; }
.shot { aspect-ratio: 4 / 3; background: #000; display: grid; place-items: center; }
.shot img { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; display: block; }
.shot .none { color: var(--muted); font-size: 44px; font-weight: 800; }
.body { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 6px; flex: 1; }
.card h2 { margin: 0; font-size: 20px; line-height: 1.25; }
.by, .meta { margin: 0; color: var(--muted); font-size: 14px; }
.meta { font-size: 13px; }
.desc { margin: 4px 0 0; font-size: 15px; }
.actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: auto; padding-top: 10px; }
.play { background: var(--accent); color: #1a1205; text-decoration: none; font-weight: 700; padding: 9px 18px; border-radius: 999px; }
.play:hover { background: #ffb85a; }
.clip { background: #2c313b; color: var(--text); border: 1px solid var(--line); border-radius: 999px; padding: 8px 14px; font: inherit; font-size: 14px; cursor: pointer; }
.clip[aria-pressed="true"] { border-color: var(--accent); }
.rom { font-size: 14px; }
.table-wrap { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; background: var(--panel); border: 1px solid var(--line); }
caption { text-align: left; color: var(--muted); padding: 0 0 10px; }
th, td { padding: 10px 12px; border-bottom: 1px solid var(--line); text-align: left; }
td.n { font-variant-numeric: tabular-nums; }
thead th { color: var(--muted); font-size: 14px; }
.podium th[scope="row"] a { font-weight: 700; }
footer { border-top: 1px solid var(--line); padding: 20px 16px 32px; text-align: center; color: var(--muted); font-size: 14px; }
footer p { margin: 4px 0; }
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

const BLANK_GIF = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function page(title: string, description: string, body: string, script = ""): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<style>${CSS}</style>
</head>
<body>
${body}
<footer>
  <p>Each game is also a 7800 ROM: it plays in 7800 emulators and, with a flash cartridge, on a 7800+, 2600+ or 7800.</p>
  <p>Made with Cartridge Studio. Not affiliated with or endorsed by Atari.</p>
</footer>
${script ? `<script>${script}</script>` : ""}
</body>
</html>
`;
}

function header(info: GalleryInfo, kicker: string, links: string[]): string {
  const rules = (info.constraints ?? []).filter((c) => c.trim());
  const all = [...links, ...(info.link ? [`<a href="${esc(info.link)}">About the jam</a>`] : [])];
  return `<header>
  <p class="kicker">${kicker}</p>
  <h1>${esc(info.name.trim() || "Game jam")}</h1>
  ${info.theme ? `<p class="theme">Theme: <strong>${esc(info.theme)}</strong></p>` : ""}
  ${info.dates ? `<p class="dates">${esc(info.dates)}</p>` : ""}
  ${rules.length ? `<ul class="rules" aria-label="Rules">${rules.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
  ${all.length ? `<p class="links">${all.join("")}</p>` : ""}
</header>`;
}

function card(e: Listed, i: number, anonymous: boolean): string {
  const m = e.read.manifest;
  const t = esc(m.title);
  const dir = `entries/${e.slug}`;
  const shotId = `shot-${i}`;
  const shot = e.read.files.thumbnail
    ? `<img id="${shotId}" src="${dir}/thumbnail.png" alt="Screenshot of ${t}" width="320" height="240">`
    : e.read.files.clip
      ? `<img id="${shotId}" src="${BLANK_GIF}" alt="" width="320" height="240">`
      : `<span class="none" aria-hidden="true">${esc(m.title.slice(0, 1).toUpperCase())}</span>`;
  const clip = e.read.files.clip
    ? `<button type="button" class="clip" hidden aria-pressed="false" aria-controls="${shotId}" data-clip="${dir}/clip.gif" data-alt="${esc(`Clip of ${m.title} being played`)}">Watch clip</button>`
    : "";
  return `<li>
<article class="card" aria-labelledby="t-${i}">
  <div class="shot">${shot}</div>
  <div class="body">
    <h2 id="t-${i}">${t}</h2>
    ${!anonymous && m.credits ? `<p class="by">By ${esc(m.credits)}</p>` : ""}
    ${m.description ? `<p class="desc">${esc(m.description)}</p>` : ""}
    ${m.controls ? `<p class="meta"><span class="visually-hidden">Controls: </span>${esc(m.controls)}</p>` : ""}
    ${m.licence ? `<p class="meta">Licence: ${esc(licenceName(m.licence))}</p>` : ""}
    <div class="actions">
      <a class="play" href="${dir}/play.html">Play<span class="visually-hidden"> ${t}</span></a>
      ${clip}
      <a class="rom" href="${dir}/${e.slug}.a78" download>ROM<span class="visually-hidden"> of ${t}</span> (.a78)</a>
    </div>
  </div>
</article>
</li>`;
}

export function galleryIndexHtml(info: GalleryInfo, entries: Listed[], opts: GalleryOptions = {}): string {
  const name = esc(info.name.trim() || "Game jam");
  const n = entries.length;
  const links = opts.results ? [`<a href="results.html">Results</a>`] : [];
  return page(
    `${name}: the entries`,
    `${n} games made for ${name}${info.theme ? `, on the theme ${esc(info.theme)}` : ""}.`,
    `<a class="skip" href="#entries">Skip to the games</a>
${header(info, "Game jam", links)}
<main id="entries" tabindex="-1">
  <p class="count">${n} ${n === 1 ? "game" : "games"}, in title order. Every one plays in this browser, with a keyboard or a gamepad.</p>
  <ul class="grid">
${entries.map((e, i) => card(e, i, !!opts.anonymous)).join("\n")}
  </ul>
</main>`,
    SCRIPT,
  );
}

export function galleryZip(info: GalleryInfo, entries: GalleryEntry[], assets: PlayerAssets, opts: GalleryOptions = {}): Uint8Array {
  if (entries.length === 0) throw new Error("Add at least one entry first.");
  const list = galleryEntries(entries);
  // index.html at the top, as itch.io's HTML projects want.
  const files: Record<string, Uint8Array> = { "index.html": strToU8(galleryIndexHtml(info, list, opts)) };
  for (const [name, text] of Object.entries(playerSharedFiles(assets))) files[`player/${name}`] = strToU8(text);
  if (opts.results) files["results.html"] = strToU8(resultsHtml(info, opts.results));
  for (const e of list) {
    const dir = `entries/${e.slug}`;
    const f = e.read.files;
    const html = playerHtml({ title: e.read.manifest.title, rom: f.a78, shared: "../../player/", back: { href: "../../index.html", label: "All entries" } });
    files[`${dir}/play.html`] = strToU8(html);
    files[`${dir}/${e.slug}.a78`] = f.a78;
    if (f.clip) files[`${dir}/clip.gif`] = f.clip;
    if (f.thumbnail) files[`${dir}/thumbnail.png`] = f.thumbnail;
    if (!opts.anonymous) {
      if (f.bin) files[`${dir}/${e.slug}.bin`] = f.bin;
      if (f.cartridge) files[`${dir}/${e.slug}.cartridge`] = f.cartridge;
    }
  }
  return zipSync(files, { level: 6, mtime: MTIME });
}

/** The jam's details as the entries tell them, when there's no brief to hand. */
export function infoFromEntries(entries: ReadPackage[]): GalleryInfo {
  const jam = entries.find((e) => e.manifest.jam)?.manifest.jam;
  return { name: jam?.name ?? "Game jam", theme: jam?.theme ?? "" };
}

// Judging

/** A cell that spreadsheets won't run as a formula. */
function csvCell(v: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const DEFAULT_CRITERIA = ["Overall"];

export function judgesCsv(info: GalleryInfo, entries: GalleryEntry[], opts: GalleryOptions = {}): string {
  const criteria = info.criteria?.length ? info.criteria : DEFAULT_CRITERIA;
  const head = ["id", "title", ...(opts.anonymous ? [] : ["credits"]), "play", "licence", "compilation", "flags", "app", "rom_sha256", ...criteria, "notes"];
  const rows = galleryEntries(entries).map((e) => {
    const m = e.read.manifest;
    return [
      e.slug,
      m.title,
      ...(opts.anonymous ? [] : [m.credits]),
      `entries/${e.slug}/play.html`,
      m.licence ? licenceName(m.licence) : "none",
      m.jam?.compilation ? "yes" : "no",
      e.flags.join(" "),
      m.build.app,
      m.build.romSha256,
      ...criteria.map(() => ""),
      "",
    ];
  });
  return [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** RFC 4180 as spreadsheets save it (commas, or semicolons in some locales). */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^﻿/, "");
  const firstLine = s.split(/\r?\n/, 1)[0] ?? "";
  const sep = !firstLine.includes(",") && firstLine.includes(";") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

export interface ResultRow {
  slug: string;
  title: string;
  /** Mean score per criterion, in the brief's order; null when nobody scored it. */
  scores: (number | null)[];
  overall: number | null;
  judges: number;
}

export interface Results {
  criteria: string[];
  rows: ResultRow[];
  sheets: number;
  /** Rows or sheets that couldn't be used, in plain words. */
  problems: string[];
}

/** Averages every judge's sheet: the mean per criterion, and overall as the mean of those. */
export function tallyResults(info: GalleryInfo, entries: GalleryEntry[], sheets: { name: string; text: string }[]): Results {
  const criteria = info.criteria?.length ? info.criteria : DEFAULT_CRITERIA;
  const list = galleryEntries(entries);
  const sums = new Map(list.map((e) => [e.slug, { total: criteria.map(() => 0), count: criteria.map(() => 0), judges: 0 }]));
  const problems: string[] = [];
  for (const sheet of sheets) {
    const [head, ...rows] = parseCsv(sheet.text);
    const idCol = head?.findIndex((h) => h.trim().toLowerCase() === "id") ?? -1;
    if (!head || idCol < 0) {
      problems.push(`${sheet.name}: no "id" column, so it isn't a judges' sheet.`);
      continue;
    }
    const cols = criteria.map((c) => head.findIndex((h) => h.trim().toLowerCase() === c.toLowerCase()));
    for (const r of rows) {
      const id = r[idCol]?.trim() ?? "";
      const s = sums.get(id);
      if (!s) {
        problems.push(`${sheet.name}: there's no entry "${id}".`);
        continue;
      }
      let scored = false;
      cols.forEach((col, k) => {
        const raw = col >= 0 ? (r[col] ?? "").trim().replace(",", ".") : "";
        if (!raw) return;
        const v = Number(raw);
        if (!Number.isFinite(v)) {
          problems.push(`${sheet.name}: "${raw}" for ${id} isn't a number.`);
          return;
        }
        s.total[k]! += v;
        s.count[k]! += 1;
        scored = true;
      });
      if (scored) s.judges++;
    }
  }
  const out: ResultRow[] = list.map((e) => {
    const s = sums.get(e.slug)!;
    const scores = criteria.map((_, k) => (s.count[k] ? s.total[k]! / s.count[k]! : null));
    const have = scores.filter((x): x is number => x !== null);
    return { slug: e.slug, title: e.read.manifest.title, scores, overall: have.length ? have.reduce((a, b) => a + b, 0) / have.length : null, judges: s.judges };
  });
  out.sort((a, b) => (b.overall ?? -Infinity) - (a.overall ?? -Infinity) || a.title.localeCompare(b.title));
  return { criteria, rows: out, sheets: sheets.length, problems };
}

const fmt = (v: number | null) => (v === null ? "–" : v.toFixed(2));

export function resultsHtml(info: GalleryInfo, r: Results): string {
  const name = esc(info.name.trim() || "Game jam");
  let rank = 0;
  let prev: number | null | undefined;
  const rows = r.rows.map((row, i) => {
    if (row.overall !== prev) rank = i + 1;
    prev = row.overall;
    return `<tr${rank <= 3 && row.overall !== null ? ' class="podium"' : ""}>
  <td class="n">${row.overall === null ? "" : rank}</td>
  <th scope="row"><a href="entries/${row.slug}/play.html">${esc(row.title)}</a></th>
  ${row.scores.map((s) => `<td class="n">${fmt(s)}</td>`).join("")}
  <td class="n"><strong>${fmt(row.overall)}</strong></td>
  <td class="n">${row.judges}</td>
</tr>`;
  });
  return page(
    `${name}: results`,
    `The results of ${name}.`,
    `${header(info, "Results", [`<a href="index.html">All entries</a>`])}
<main>
  <div class="table-wrap">
  <table>
    <caption>Mean scores from ${r.sheets} ${r.sheets === 1 ? "judge's sheet" : "judges' sheets"}; overall is the mean of the criteria.</caption>
    <thead><tr><th scope="col">Rank</th><th scope="col">Game</th>${r.criteria.map((c) => `<th scope="col">${esc(c)}</th>`).join("")}<th scope="col">Overall</th><th scope="col">Judges</th></tr></thead>
    <tbody>
${rows.join("\n")}
    </tbody>
  </table>
  </div>
</main>`,
  );
}
