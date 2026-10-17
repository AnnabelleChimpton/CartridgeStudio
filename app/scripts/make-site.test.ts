// Generated parts of the landing page (site/). Run after make-clips, or on its
// own when only the games or the compatibility data changed:
//
//   site/play/ghost-panic.html  the one-file player the hero loads on click
//   site/play/ghost-panic.a78   the signed cartridge file it plays
//   site/play/key-quest.png     a still of a starter the clips don't cover
//   site/play/play.json         the .a78's size and title, for anything else that wants it
//
// and fills every `<!-- gen:name -->…<!-- /gen:name -->` region of
// site/index.html (download size, clip grid, counts, the rule sentence and its
// generated 7800basic, the compatibility table from compatibility.json, the
// toolchain versions), so the page shows the numbers from this build and still
// works opened from disk with scripts off.
//
// Not part of the test suite. Run from app/:
//   npx vitest run --config scripts/site.config.ts

import fs from "node:fs";
import path from "node:path";
import { it } from "vitest";
import { CLIP_HEIGHT, CLIP_WIDTH } from "../src/files/clip.ts";
import { encodeRgbaPng } from "../src/files/png.ts";
import { nodeBuilder, nodeHost } from "../src/harness/node.ts";
import { generateKit } from "../src/kit/generate.ts";
import { loadKit } from "../src/kit/migrations.ts";
import { KIT_PRESETS } from "../src/kit/presets.ts";
import { MAX_TYPES, type KitGame } from "../src/kit/schema.ts";
import { ruleSentence } from "../src/kit/sentence.ts";
import { buildKitRom } from "../src/kit/tests.ts";
import { playerInfo } from "../src/player/game-info.ts";
import { playerHtml } from "../src/player/player.ts";
import { SOUND_LIBRARY } from "../src/project/templates.ts";

const root = path.resolve(import.meta.dirname, "../..");
const site = path.join(root, "site");
const playDir = path.join(site, "play");
const vendor = path.join(root, "app/public/vendor/js7800-core");

/** The game the hero plays, and the rules the page quotes from it. */
const HERO = "ghost-panic";
const STEP_RULE = "r-1";
const BAS_RULE = "r-8";
/** The starter shown as a still in "Who uses it" (it has no clip yet). */
const STILL = "key-quest";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const word = (n: number) => WORDS[n] ?? String(n);
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

function loadGame(id: string): KitGame {
  const loaded = loadKit(JSON.parse(fs.readFileSync(path.join(root, "templates/kit/games", `${id}.json`), "utf8")));
  if (!loaded.ok) throw new Error(`${id}: ${loaded.errors.join(" ")}`);
  return loaded.game;
}

/** What each clip shows, for its alt text. Keyed by id; a clip without one gets a plain line. */
const CLIP_ALT: Record<string, string> = {
  shooter: "a cat at the bottom of the screen slides left and right, firing up at two marching rows of vacuum cleaners and stepping out from under their falling dust.",
  maze: "a cat threads through a brick maze collecting balls of yarn while ghosts chase it and a bat patrols the middle corridor.",
  dodger: "the player weaves along the bottom of the screen between falling hazards, catching the good things for points.",
};

interface ClipEntry {
  id: string;
  title: string;
  gif: string;
  still: string;
  width: number;
  height: number;
}

interface CompatRow {
  console: string;
  firmware: string;
  cartridge: string;
  result: string;
  date: string;
  report?: string;
}

function replaceRegion(html: string, name: string, content: string): string {
  const re = new RegExp(`(<!-- gen:${name} -->)[\\s\\S]*?(<!-- /gen:${name} -->)`, "g");
  if (!re.test(html)) throw new Error(`site/index.html has no gen:${name} region`);
  return html.replace(re, (_, open: string, close: string) => `${open}${content}${close}`);
}

function clipItem(c: ClipEntry): string {
  const preset = KIT_PRESETS.find((p) => p.id === c.id);
  const title = preset?.name ?? c.title;
  const alt = `${title}: ${CLIP_ALT[c.id] ?? "recorded from the built ROM."}`;
  const caption = preset?.description ? `${title}. ${preset.description}` : title;
  return `
          <li>
            <figure class="tv">
              <div class="screen">
                <picture>
                  <source srcset="clips/${esc(c.still)}" media="(prefers-reduced-motion: reduce)">
                  <img class="clip" src="clips/${esc(c.gif)}" width="${c.width}" height="${c.height}" loading="lazy" decoding="async"
                       data-still="clips/${esc(c.still)}" data-moving="clips/${esc(c.gif)}"
                       alt="${esc(alt)}">
                </picture>
              </div>
              <figcaption>${esc(caption)}</figcaption>
            </figure>
          </li>`;
}

function compatTable(data: { note?: string; rows?: CompatRow[] }): string {
  const rows = data.rows ?? [];
  const body = rows.length
    ? rows
        .map((r) => {
          const result = r.report && /^https:\/\//.test(r.report) ? `<a href="${esc(r.report)}">${esc(r.result)}</a>` : esc(r.result);
          return `
              <tr><td>${esc(r.console)}</td><td>${esc(r.firmware)}</td><td>${esc(r.cartridge)}</td><td>${result}</td><td>${esc(r.date)}</td></tr>`;
        })
        .join("")
    : `
              <tr><td colspan="5">${esc(data.note ?? "Not yet tested on hardware.")}</td></tr>`;
  return `
          <div class="table-scroll" tabindex="0" role="region" aria-labelledby="compat-title">
            <table class="compat-table">
              <thead><tr><th scope="col">Console</th><th scope="col">Firmware</th><th scope="col">Cartridge</th><th scope="col">Result</th><th scope="col">Date</th></tr></thead>
              <tbody>${body}
              </tbody>
            </table>
          </div>
          `;
}

it(
  "makes the landing page's generated parts",
  async () => {
    const builder = await nodeBuilder();
    const host = await nodeHost();
    fs.mkdirSync(playDir, { recursive: true });

    // ---- The hero's player and cartridge file. ----
    const game = loadGame(HERO);
    const rom = await buildKitRom(game, SOUND_LIBRARY, builder, true);
    if (!rom.ok) throw new Error(`${HERO}: ${rom.failure}`);
    const core = fs.readFileSync(path.join(vendor, "js7800-core.js"), "utf8");
    const license = `${fs.readFileSync(path.join(vendor, "LICENSE"), "utf8")}\n\n${fs.readFileSync(path.join(vendor, "LICENSE-third-party"), "utf8")}`;
    fs.writeFileSync(path.join(playDir, `${HERO}.html`), playerHtml({ title: game.title, rom: rom.a78, core, license, info: playerInfo(game) }));
    fs.writeFileSync(path.join(playDir, `${HERO}.a78`), rom.a78);
    const kb = Math.round(rom.a78.length / 1024);
    fs.writeFileSync(
      path.join(playDir, "play.json"),
      JSON.stringify({ id: HERO, title: game.title, html: `${HERO}.html`, a78: `${HERO}.a78`, bytes: rom.a78.length, kb }, null, 2) + "\n",
    );

    // ---- A still of the starter without a clip: its first second of play. ----
    const stillGame = loadGame(STILL);
    const stillRom = await buildKitRom(stillGame, SOUND_LIBRARY, builder);
    if (!stillRom.ok) throw new Error(`${STILL}: ${stillRom.failure}`);
    await host.load(stillRom.a78);
    host.step(30);
    host.setInput({ up: false, down: false, left: false, right: false, fire: true });
    host.step(2);
    host.setInput({ up: false, down: false, left: false, right: false, fire: false });
    host.step(60);
    const idx = host.indices();
    const pal = host.paletteRgb;
    const rgba = new Uint8Array(CLIP_WIDTH * CLIP_HEIGHT * 4);
    for (let i = 0; i < idx.length; i++) rgba.set([pal[idx[i]! * 3]!, pal[idx[i]! * 3 + 1]!, pal[idx[i]! * 3 + 2]!, 255], i * 4);
    fs.writeFileSync(path.join(playDir, `${STILL}.png`), encodeRgbaPng(CLIP_WIDTH, CLIP_HEIGHT, rgba));

    // ---- One rule's sentence and the 7800basic generated for it. ----
    const gen = generateKit(game, SOUND_LIBRARY);
    if (!gen.ok) throw new Error(gen.errors.join("; "));
    const rule = (id: string) => {
      const r = game.rules.find((x) => x.id === id);
      if (!r) throw new Error(`${HERO} has no rule ${id}`);
      return r;
    };
    const stepSentence = ruleSentence(rule(STEP_RULE), game);
    const basSentence = ruleSentence(rule(BAS_RULE), game);
    if (process.env.SITE_TRACE) for (const sp of gen.spans) process.stdout.write(`${sp.kind}:${sp.id} ${sp.from}-${sp.to}\n`);
    // A rule's code is in two places: its trigger in the rule loop, and its actions in a subroutine.
    const spans = gen.spans.filter((s) => s.kind === "rule" && s.id === BAS_RULE).sort((a, b) => a.from - b.from);
    if (!spans.length) throw new Error(`No source span for ${BAS_RULE}`);
    const source = gen.input.source.split("\n");
    const bas = spans
      .map((sp) => {
        const lines = source.slice(sp.from - 1, sp.to);
        const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => /^ */.exec(l)![0].length));
        return lines.map((l) => l.slice(indent)).join("\n");
      })
      .join("\n\n");
    const where = spans.map((sp) => `${sp.from} to ${sp.to}`);
    const lineWords = `lines ${where.length > 1 ? `${where.slice(0, -1).join(", ")} and ${where.at(-1)}` : where[0]}`;

    // ---- Data for the regions. ----
    const clips = JSON.parse(fs.readFileSync(path.join(site, "clips/clips.json"), "utf8")) as ClipEntry[];
    const heroClip = clips.find((c) => c.id === HERO);
    if (!heroClip) throw new Error(`clips.json has no ${HERO}`);
    const compatPath = path.join(root, "compatibility.json");
    const compat = JSON.parse(fs.readFileSync(compatPath, "utf8")) as { note?: string; rows?: CompatRow[] };
    const lock = JSON.parse(fs.readFileSync(path.join(root, "toolchain/toolchain.lock.json"), "utf8")) as { version: string };
    const commit = /Commit: `([0-9a-f]{7})/.exec(fs.readFileSync(path.join(vendor, "README.md"), "utf8"))?.[1];
    if (!commit) throw new Error("No js7800 commit in its README");
    const t = esc(game.title);

    let html = fs.readFileSync(path.join(site, "index.html"), "utf8");
    const set = (name: string, content: string) => (html = replaceRegion(html, name, content));
    set(
      "hero-play",
      `
          <div class="poster" id="poster">
            <img src="clips/${esc(heroClip.still)}" width="${heroClip.width}" height="${heroClip.height}" fetchpriority="high"
                 alt="${t}, a still from the recording: the cat in a blue brick maze with the ghosts, catnip and the score.">
            <button class="button" type="button" id="play-here" hidden data-src="play/${HERO}.html" data-title="${t}, playable">Play ${t} here</button>
          </div>
          `,
    );
    set("download", `<a href="play/${HERO}.a78" download="${HERO}.a78">Download the .a78 (${kb} KB)</a>`);
    set("clips", clips.filter((c) => c.id !== HERO).map(clipItem).join("") + "\n        ");
    set("clip-count", word(clips.length));
    set("starter-count", cap(word(KIT_PRESETS.length)));
    set("max-types", word(MAX_TYPES));
    const kinds = KIT_PRESETS.map((p, i) => (i === 0 ? p.kind : p.kind.replace(/^A/, "a")));
    set("kinds", `${kinds.length > 1 ? `${kinds.slice(0, -1).join(", ")} or ${kinds.at(-1)}` : kinds[0]}.`);
    set("rule-step", esc(stepSentence));
    set(
      "bas",
      `
            <figure class="bas-excerpt">
              <figcaption>
                <p class="rule">${esc(basSentence)}</p>
                <p>A ${t} rule, and the 7800basic Cartridge Studio generates for it: ${lineWords} of game.bas.</p>
              </figcaption>
              <pre tabindex="0"><code>${esc(bas)}</code></pre>
            </figure>
            `,
    );
    set(
      "still",
      `
            <img src="play/${STILL}.png" width="${CLIP_WIDTH}" height="${CLIP_HEIGHT}" loading="lazy" decoding="async"
                 alt="${esc(stillGame.title)}, the first room a second after the start: a blue brick room with a doorway in its bottom wall.">
            `,
    );
    set("still-title", esc(stillGame.title));
    set("compat", compatTable(compat));
    set("basic-version", esc(lock.version));
    set("js7800-commit", esc(commit));
    fs.writeFileSync(path.join(site, "index.html"), html);

    process.stdout.write(`${HERO}.a78: ${rom.a78.length} bytes (${kb} KB); rule ${BAS_RULE}: ${lineWords}; ${clips.length} clips, ${KIT_PRESETS.length} starters, ${(compat.rows ?? []).length} compatibility rows\n`);
  },
  10 * 60_000,
);
