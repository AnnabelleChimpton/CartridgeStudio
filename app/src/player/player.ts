// "Send to family": one self-contained HTML file that plays the game in any
// modern browser, offline, with no install: the ROM, the js7800 core
// (unmodified, GPL v2 or later, with its licence) and a small runtime, inline.

import runtime from "./runtime.js?raw";

/** A one-file page: the core, runtime and licence are inline. */
export interface PlayerPage {
  title: string;
  rom: Uint8Array;
  /** js7800-core.js (an ES module with no imports). */
  core: string;
  /** js7800's licence texts, shown in the page. */
  license: string;
}

/** A page that shares the core, runtime and licence with others (see playerSharedFiles), e.g. in a jam gallery. */
export interface LinkedPlayerPage {
  title: string;
  rom: Uint8Array;
  /** Where the shared files are, relative to the page, ending in "/". */
  shared: string;
  /** A link back, e.g. to the gallery. */
  back?: { href: string; label: string };
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
/** Script text can't contain "</script"; this keeps it inert inside a script element. */
const scriptSafe = (s: string) => s.replace(/<\/(script)/gi, "<\\/$1");
/** JSON for inside a script element: no "<" (so no "</script>" or "<!--") and no line separators. */
export const jsonForScript = (v: unknown) =>
  JSON.stringify(v).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

function base64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** The core as a classic script that sets window.JS7800 (its `export { a as B }` becomes an object). */
export function coreAsScript(core: string): string {
  const m = /export\s*\{([^}]*)\}\s*;?\s*$/.exec(core);
  if (!m) throw new Error("Unexpected js7800 core format");
  const fields = m[1]!
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const [local, , exported] = p.split(/\s+/);
      return `${exported ?? local}: ${local}`;
    });
  return `(function(){\n${core.slice(0, m.index)}\nwindow.JS7800 = { ${fields.join(", ")} };\n})();`;
}

export function playerHtml(page: PlayerPage | LinkedPlayerPage): string {
  const { title, rom } = page;
  const linked = "shared" in page;
  const t = escapeHtml(title.trim() || "My game");
  const shared = linked ? escapeHtml(page.shared) : "";
  const back = linked && page.back ? `<a class="back" href="${escapeHtml(page.back.href)}">&larr; ${escapeHtml(page.back.label)}</a>\n` : "";
  const licence = linked
    ? `<p><a href="${shared}LICENSE.txt">The js7800 licence</a></p>`
    : `<pre>${escapeHtml(page.license)}</pre>`;
  const scripts = linked
    ? `<script src="${shared}js7800-core.js"></script>\n<script src="${shared}runtime.js"></script>`
    : `<script>${scriptSafe(coreAsScript(page.core))}</script>\n<script>${scriptSafe(runtime)}</script>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t}</title>
<style>
  html, body { margin: 0; height: 100%; background: #000; color: #e6e8ec; font: 16px/1.4 system-ui, sans-serif; }
  body { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 16px; box-sizing: border-box; }
  h1 { margin: 0; font-size: clamp(18px, 4vw, 34px); letter-spacing: 0.04em; text-align: center; }
  #stage { position: relative; width: min(100%, calc((100vh - 170px) * 4 / 3)); aspect-ratio: 4 / 3; background: #000; }
  #stage:fullscreen { width: 100vw; height: 100vh; aspect-ratio: auto; display: grid; place-items: center; }
  #screen { width: 100%; height: 100%; image-rendering: pixelated; display: block; }
  #stage:fullscreen #screen { width: min(100vw, calc(100vh * 4 / 3)); height: auto; aspect-ratio: 4 / 3; }
  #start { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font: 600 clamp(16px, 3vw, 26px) system-ui, sans-serif;
    padding: 14px 26px; border: 0; border-radius: 999px; background: #f0a23a; color: #1a1205; cursor: pointer; }
  .playing #start { display: none; }
  .bar { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; justify-content: center; color: #9aa1ad; font-size: 14px; }
  button.plain { background: #2c313b; color: #e6e8ec; border: 0; border-radius: 6px; padding: 8px 14px; font: inherit; cursor: pointer; }
  details { max-width: 640px; color: #9aa1ad; font-size: 12px; }
  pre { white-space: pre-wrap; max-height: 240px; overflow: auto; }
  a { color: #f0a23a; }
  .back { align-self: flex-start; font-size: 15px; }
</style>
</head>
<body>
${back}<h1>${t}</h1>
<div id="stage">
  <canvas id="screen" width="320" height="240" aria-label="${t}"></canvas>
  <button id="start" type="button">Press to play</button>
</div>
<div class="bar">
  <span>Arrow keys move · Space fires · Gamepads work too</span>
  <button id="fullscreen" class="plain" type="button">Full screen</button>
</div>
<details>
  <summary>Made with Cartridge Studio · About this page</summary>
  <p>This page plays an Atari 7800 game made with Cartridge Studio. It runs the js7800 emulator by raz0red
  (<a href="https://github.com/raz0red/js7800">github.com/raz0red/js7800</a>, commit fe918ce), unmodified, under the GNU GPL v2 or later.
  Not affiliated with or endorsed by Atari.</p>
  ${licence}
</details>
<script>window.GAME = ${jsonForScript({ title: title.trim(), rom: base64(rom) })};</script>
${scripts}
</body>
</html>
`;
}

/** The files a LinkedPlayerPage loads, by name. */
export function playerSharedFiles({ core, license }: PlayerAssets): Record<string, string> {
  return { "js7800-core.js": coreAsScript(core), "runtime.js": runtime, "LICENSE.txt": license };
}

export interface PlayerAssets {
  core: string;
  license: string;
}

/** Fetches the core and its licences from the app. */
export async function loadPlayerAssets(): Promise<PlayerAssets> {
  const base = `${import.meta.env.BASE_URL}vendor/js7800-core/`;
  const get = async (name: string) => {
    const res = await fetch(base + name);
    if (!res.ok) throw new Error(`Couldn't load ${name}`);
    return res.text();
  };
  const [core, license, third] = await Promise.all([get("js7800-core.js"), get("LICENSE"), get("LICENSE-third-party")]);
  return { core, license: `${license}\n\n${third}` };
}

/** Builds the one-file page. */
export async function buildPlayerHtml(title: string, rom: Uint8Array): Promise<string> {
  return playerHtml({ title, rom, ...(await loadPlayerAssets()) });
}
