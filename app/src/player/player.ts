// "Send to family": one self-contained HTML file that plays the game in any
// modern browser, offline, with no install: the ROM, the js7800 core
// (unmodified, GPL v2 or later, with its licence) and a small runtime, inline.

import runtime from "./runtime.js?raw";
import { fontRows } from "../kit/font.ts";
import { tokensCss } from "../ui/tokens.ts";
import { controlsText, playerInfo, UNKNOWN_CONTROLS, type PlayerInfo } from "./game-info.ts";

/** A one-file page: the core, runtime and licence are inline. */
export interface PlayerPage {
  title: string;
  rom: Uint8Array;
  /** js7800-core.js (an ES module with no imports). */
  core: string;
  /** js7800's licence texts, shown in the page. */
  license: string;
  /** How it's played and its box art (from playerInfo); without it the page offers every control. */
  info?: PlayerInfo;
  /** The app's address, for the "Made with" link. */
  home?: string;
}

/** A page that shares the core, runtime and licence with others (see playerSharedFiles), e.g. in a jam gallery. */
export interface LinkedPlayerPage {
  title: string;
  rom: Uint8Array;
  /** Where the shared files are, relative to the page, ending in "/". */
  shared: string;
  /** A link back, e.g. to the gallery. */
  back?: { href: string; label: string };
  info?: PlayerInfo;
  home?: string;
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

/** What the page says when it's opened somewhere that shows the file without running it (iOS Files and Mail previews). */
export const NO_SCRIPTS_TEXT =
  "If you can read this, the game isn't running: this is a preview that shows the file but doesn't start it. " +
  "On an iPhone or iPad, the Files and Mail previews can't play it, so open it on a computer or an Android phone instead. " +
  "On Android, save the file, then open it from the Files app and choose Chrome. " +
  "On a computer, open it in Chrome, Edge, Firefox or Safari. No internet is needed.";

/** Characters the kit's 3×5 font draws (kit/font.ts). */
const KIT_CHARS = /^[A-Z0-9 .!?\-:']+$/;

/**
 * A title in the kit's 3×5 font, as square-pixel SVG at an integer scale, with the words as real text.
 * Titles with a character the font lacks are plain bold text instead.
 */
export function kitTitle(title: string, scale: number, decorative = false): string {
  const text = title.toUpperCase();
  if (!KIT_CHARS.test(text)) return escapeHtml(title);
  const rows = fontRows(text).slice(1, 6);
  const width = rows[0]!.length - 1;
  const rects: string[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === "0") continue;
      const start = x;
      while (x + 1 < row.length && row[x + 1] !== "0") x++;
      rects.push(`<rect x="${start}" y="${y}" width="${x - start + 1}" height="1"/>`);
    }
  });
  const svg = `<svg width="${width * scale}" height="${5 * scale}" viewBox="0 0 ${width} 5" shape-rendering="crispEdges" aria-hidden="true">${rects.join("")}</svg>`;
  return decorative ? svg : `${svg}<span class="sr-only">${escapeHtml(title)}</span>`;
}

export function playerHtml(page: PlayerPage | LinkedPlayerPage): string {
  const { title, rom } = page;
  const linked = "shared" in page;
  const t = escapeHtml(title.trim() || "My game");
  const shared = linked ? escapeHtml(page.shared) : "";
  const back = linked && page.back ? `<a class="back" href="${escapeHtml(page.back.href)}">&larr; ${escapeHtml(page.back.label)}</a>\n` : "";
  const licence = linked
    ? `<p><a href="${shared}LICENSE.txt">The js7800 licence</a></p>`
    : `<pre tabindex="0" aria-label="The js7800 licence">${escapeHtml(page.license)}</pre>`;
  const scripts = linked
    ? `<script src="${shared}js7800-core.js"></script>\n<script src="${shared}runtime.js"></script>`
    : `<script>${scriptSafe(coreAsScript(page.core))}</script>\n<script>${scriptSafe(runtime)}</script>`;
  const controls = page.info?.controls ?? UNKNOWN_CONTROLS;
  const words = controlsText(controls);
  const fireLabel = controls.button === "start" ? "Start" : "Fire";
  const home = page.home && /^https?:\/\//.test(page.home) ? escapeHtml(page.home) : "";
  const made = home ? `<a href="${home}" rel="noreferrer">Made with Cartridge Studio</a>` : "Made with Cartridge Studio";
  const dpad =
    controls.move === "lr"
      ? `<div id="dpad" class="dpad lr" aria-hidden="true"><span class="arrow left"></span><span class="arrow right"></span></div>`
      : controls.move === "free"
        ? `<div id="dpad" class="dpad free" aria-hidden="true"><span class="arrow up"></span><span class="arrow left"></span><span class="arrow right"></span><span class="arrow down"></span></div>`
        : "";
  return `<!doctype html>
<html lang="en" class="nojs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${t}</title>
<style>
  /* The app's tokens (ui/tokens.ts): NTSC palette entries, radii and motion. */
${tokensCss()}  :root { --black: var(--mat); }
  html, body { margin: 0; min-height: 100%; background: var(--bg); color: var(--text); font: 16px/1.45 var(--font-ui); }
  body { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 16px; box-sizing: border-box;
    min-height: 100vh; min-height: 100dvh; touch-action: manipulation; }
  h1 { margin: 0; text-align: center; font-size: clamp(18px, 4vw, 30px); line-height: 1.2; }
  h1 svg, #box svg { display: block; margin: 0 auto; max-width: 100%; height: auto; fill: var(--text); }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  #noplay { max-width: 34em; margin: 0; padding: 12px 16px; background: var(--surface); border: 1px solid var(--accent); border-radius: var(--r-lg); }
  .js #noplay { display: none; }
  .nojs #start, .nojs .bar button, .nojs #pad, .nojs #skip { display: none; }
  main { display: contents; }
  #game { display: flex; flex-direction: column; align-items: center; gap: 16px; width: 100%; }
  /* The same plain TV bezel as the app, with its power light: on while the game runs, dim while paused. */
  .bezel { position: relative; box-sizing: border-box; width: min(100%, calc((100vh - 250px) * 4 / 3 + 24px)); padding: 12px 12px 22px;
    border-radius: var(--r-lg); background: var(--raised); border: 1px solid var(--line); }
  #power { position: absolute; right: 16px; bottom: 7px; width: 8px; height: 8px; background: var(--power-off); }
  .playing #power { background: var(--power-on); }
  .playing.paused #power { background: var(--power-paused); }
  #stage { position: relative; width: 100%; aspect-ratio: 4 / 3; background: var(--mat); touch-action: none; }
  #stage:fullscreen { width: 100vw; height: 100vh; aspect-ratio: auto; display: grid; place-items: center; }
  #screen { width: 100%; height: 100%; image-rendering: pixelated; display: block; outline: none; }
  #screen:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  #stage:fullscreen #screen { width: min(100vw, calc(100vh * 4 / 3)); height: auto; aspect-ratio: 4 / 3; }
  #box { position: absolute; inset: 0; overflow: hidden; background: var(--box-bg, var(--mat)); transition: opacity var(--dur) var(--ease-out); }
  #box::after { content: ""; position: absolute; inset: 0; box-shadow: inset 0 0 0 6px var(--c1, var(--line)); }
  #box > canvas { position: absolute; inset: 0; width: 100%; height: 100%; image-rendering: pixelated; }
  #box .box-title { position: absolute; left: 6%; right: 6%; top: 9%; margin: 0; text-align: center; color: var(--text);
    font: 700 clamp(20px, 6vw, 48px) / 1.05 var(--font-ui); text-transform: uppercase; }
  #box svg { width: 88%; filter: drop-shadow(2px 2px 0 var(--mat)); }
  #box.gone { opacity: 0; pointer-events: none; }
  @media (prefers-reduced-motion: reduce) { #box { transition: none; } }
  button { font: 700 15px / 1.2 var(--font-ui); border: 0; border-radius: var(--r-sm); cursor: pointer; min-height: 44px; padding: 8px 14px; margin-bottom: 2px; }
  button:active { transform: translateY(2px); box-shadow: none; }
  button:focus-visible, a:focus-visible, summary:focus-visible, pre:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  /* Keycaps: the accent with its 2px edge, or the raised grey with its line. */
  #start { position: absolute; left: 50%; bottom: 7%; transform: translateX(-50%); z-index: 2; white-space: nowrap;
    font-size: clamp(15px, min(2.6vw, 4vh), 22px); padding: 10px 18px; background: var(--accent); color: var(--on-accent); box-shadow: 0 2px 0 var(--edge); }
  #start:hover { background: var(--accent-hover); }
  #start:active { transform: translate(-50%, 2px); }
  button.plain { background: var(--raised); color: var(--text); box-shadow: 0 2px 0 var(--line); }
  button.plain:hover { background: var(--line); }
  #skip { position: absolute; right: 8px; bottom: 8px; z-index: 2; }
  .playing #start, .playing #skip, #skip.gone { display: none; }
  #paused { position: absolute; left: 50%; top: 12px; transform: translateX(-50%); margin: 0; padding: 6px 14px; border-radius: var(--r-sm);
    background: var(--black); color: var(--text); font-weight: 700; }
  .bar { display: flex; gap: 10px 14px; align-items: center; flex-wrap: wrap; justify-content: center; color: var(--muted); font-size: 15px; }
  .bar p { margin: 0; text-align: center; }
  footer { display: flex; flex-direction: column; align-items: center; gap: 2px; color: var(--muted); font-size: 13px; text-align: center; }
  footer p { margin: 0; }
  details { max-width: 640px; font-size: 13px; }
  summary { cursor: pointer; padding: 6px 0; }
  pre { white-space: pre-wrap; max-height: 240px; overflow: auto; text-align: left; font-size: 12px; }
  a { color: var(--accent-text); }
  .back { align-self: flex-start; font-size: 15px; }
  /* Touch: a pad and a button under the screen, or beside it when the phone is sideways. */
  #pad { display: none; }
  .touch #pad { display: flex; justify-content: space-between; align-items: center; gap: 24px; width: min(100%, 520px);
    touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
  .dpad { position: relative; box-sizing: border-box; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); touch-action: none; }
  .dpad.free { width: 168px; height: 168px; }
  .dpad.lr { width: 208px; height: 92px; }
  .arrow { position: absolute; width: 0; height: 0; border: 14px solid transparent; }
  .free .up { left: calc(50% - 14px); top: 12px; border-bottom: 20px solid var(--muted); border-top: 0; }
  .free .down { left: calc(50% - 14px); bottom: 12px; border-top: 20px solid var(--muted); border-bottom: 0; }
  .free .left, .lr .left { top: calc(50% - 14px); left: 14px; border-right: 20px solid var(--muted); border-left: 0; }
  .free .right, .lr .right { top: calc(50% - 14px); right: 14px; border-left: 20px solid var(--muted); border-right: 0; }
  .dpad .on.up { border-bottom-color: var(--accent); } .dpad .on.down { border-top-color: var(--accent); }
  .dpad .on.left { border-right-color: var(--accent); } .dpad .on.right { border-left-color: var(--accent); }
  #fire { display: grid; place-items: center; width: 104px; height: 104px; border-radius: var(--r-sm); margin-left: auto; background: var(--accent); color: var(--on-accent);
    font-weight: 700; font-size: 18px; box-shadow: 0 4px 0 var(--edge); touch-action: none; }
  #fire.on { transform: translateY(4px); box-shadow: none; }
  @media (orientation: landscape) and (max-height: 560px) {
    .touch { padding: 8px; gap: 6px; justify-content: flex-start; }
    .touch h1 { font-size: 16px; }
    .touch h1 svg { width: auto; height: 15px; }
    .touch #game { flex-direction: row; justify-content: center; gap: 12px; }
    .touch .bezel { width: min(calc(100vw - 2 * 196px), calc((100vh - 120px) * 4 / 3 + 24px)); order: 2; padding: 6px 6px 16px; }
    .touch #power { bottom: 4px; }
    .touch #pad { display: contents; }
    .touch .dpad { order: 1; flex: none; }
    .touch #fire { order: 3; flex: none; margin-left: 0; }
    .touch .dpad.lr { width: 172px; }
  }
</style>
</head>
<body>
<p id="noplay">${escapeHtml(NO_SCRIPTS_TEXT)}</p>
${back}<main>
<h1>${kitTitle(title.trim() || "My game", 4)}</h1>
<div id="game">
  <div class="bezel">
  <span id="power" aria-hidden="true"></span>
  <div id="stage">
    <canvas id="screen" width="320" height="240" tabindex="0" role="application" aria-roledescription="game" aria-label="${t}" aria-describedby="controls"></canvas>
    <div id="box" aria-hidden="true"><canvas width="320" height="240"></canvas><p class="box-title">${kitTitle(title.trim() || "My game", 8, true)}</p></div>
    <p id="paused" role="status" hidden>Paused</p>
    <button id="start" type="button">Press Space or ${fireLabel} to play</button>
    <button id="skip" class="plain" type="button">Skip</button>
  </div>
  </div>
  <!-- display: contents (sideways phones) drops the pad's own aria-hidden in some browsers, so each part says it too. -->
  <div id="pad" aria-hidden="true">
    ${dpad}
    <div id="fire" aria-hidden="true">${fireLabel}</div>
  </div>
</div>
<div class="bar">
  <p id="controls" data-keys="${escapeHtml(words.keys)}" data-touch="${escapeHtml(words.touch)}">${escapeHtml(words.keys)}</p>
  <button id="pause" class="plain" type="button">Pause</button>
  <button id="restart" class="plain" type="button">Restart</button>
  <button id="fullscreen" class="plain" type="button">Full screen</button>
</div>
</main>
<footer>
  <p>${made}. Make your own 7800 game.</p>
  <p>Plays in <a href="https://github.com/raz0red/js7800">js7800</a> by raz0red (commit fe918ce), unmodified, under the GNU GPL v2 or later.</p>
  <details>
    <summary>About this page</summary>
    <p>This page holds a 7800 game made with Cartridge Studio and the js7800 emulator that plays it, so it needs no internet
    and sends nothing anywhere. Not affiliated with or endorsed by Atari.</p>
    <p>With a gamepad: Start pauses, Select plays again from the start, and holding Select for a second leaves full screen.</p>
    ${licence}
  </details>
</footer>
<script>window.GAME = ${jsonForScript({ title: title.trim(), rom: base64(rom), controls, art: page.info?.art ?? null })};</script>
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

/** Where this copy of the app lives, for the page's "Made with" link: a plain address, nothing added. */
export function appHome(): string | undefined {
  if (typeof location === "undefined" || !/^https?:$/.test(location.protocol)) return undefined;
  return new URL(import.meta.env.BASE_URL, location.href).href;
}

/** Builds the one-file page; with the game file, its controls line, touch pad and box art follow the game. */
export async function buildPlayerHtml(title: string, rom: Uint8Array, game?: unknown): Promise<string> {
  return playerHtml({ title, rom, info: game === undefined ? undefined : playerInfo(game), home: appHome(), ...(await loadPlayerAssets()) });
}
