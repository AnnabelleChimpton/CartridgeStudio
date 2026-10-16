// Checks the production build (app/dist, from `npm run build`) against size
// budgets, so a heavy dependency or an accidental eager import shows up in the
// nightly CI run instead of on a first visit over a slow connection.
//
//   node scripts/bundle-budget.mjs
//
// Sizes are gzip, as a server would send them. Raise a budget on purpose, in
// the same change that needs it, and say why in the commit.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const KB = 1024;
// Set at about 15% over the sizes measured in October 2026 (228 KB, 938 KB and 1.65 MB).
const BUDGETS = {
  /** Scripts the start page loads before anything is interactive. */
  initialJs: 260 * KB,
  /** All of the app's own JavaScript, workers and lazy chunks included. */
  allJs: 1080 * KB,
  /** Everything served, toolchain pack and emulator core included. */
  total: 2 * KB * KB,
};

const dist = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), "app", "dist");
if (!fs.existsSync(path.join(dist, "index.html"))) {
  console.error("No app/dist/index.html. Run `npm run build` first.");
  process.exit(1);
}

const files = fs.readdirSync(dist, { recursive: true }).filter((f) => fs.statSync(path.join(dist, f)).isFile());
const gz = (f) => gzipSync(fs.readFileSync(path.join(dist, f)), { level: 9 }).length;

// The start page's scripts: its entry module and everything it preloads.
const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
const initial = [...html.matchAll(/<(?:script[^>]*\ssrc|link[^>]*rel="modulepreload"[^>]*\shref)="\.?\/?([^"]+\.js)"/g)].map((m) => m[1]);
if (!initial.length) throw new Error("Found no scripts in app/dist/index.html");

const sizes = {
  initialJs: initial.reduce((n, f) => n + gz(f), 0),
  allJs: files.filter((f) => f.startsWith("assets") && f.endsWith(".js")).reduce((n, f) => n + gz(f), 0),
  total: files.reduce((n, f) => n + gz(f), 0),
};

const fmt = (n) => `${(n / KB).toFixed(0)} KB`;
let over = false;
for (const [k, budget] of Object.entries(BUDGETS)) {
  const ok = sizes[k] <= budget;
  over ||= !ok;
  console.log(`${ok ? "ok  " : "OVER"} ${k.padEnd(9)} ${fmt(sizes[k]).padStart(8)} of ${fmt(budget)} (${((100 * sizes[k]) / budget).toFixed(0)}%)`);
}
console.log(`Initial scripts: ${initial.join(", ")}`);
if (over) {
  console.error("\nOver budget. Find what grew (`npx vite build` lists chunk sizes), or raise the budget on purpose.");
  process.exit(1);
}
