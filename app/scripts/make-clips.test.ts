// Run from app/: npx vitest run --config scripts/clips.config.ts
// CLIPS=<id,id> makes only some, CLIPS_OUT=<dir> writes somewhere other than
// site/clips, and CLIPS_TRACE=1 prints each try's score by the second.

import fs from "node:fs";
import path from "node:path";
import { it } from "vitest";
import { parseSymbols, type CoreHost, type JoystickInput } from "../src/emulator/core-host.ts";
import { CLIP_HEIGHT, CLIP_WIDTH, encodeClip } from "../src/files/clip.ts";
import { encodeRgbaPng } from "../src/files/png.ts";
import { nodeBuilder, nodeHost } from "../src/harness/node.ts";
import { buildKitRom } from "../src/kit/tests.ts";
import { KitGameSchema, MAX_OBJECTS, type KitGame } from "../src/kit/schema.ts";
import { SOUND_LIBRARY } from "../src/project/templates.ts";

const root = path.resolve(import.meta.dirname, "../..");
const gamesDir = path.join(root, "templates/kit/games");
const outDir = path.resolve(root, process.env.CLIPS_OUT ?? "site/clips");

/** Frames played per try; the clip is the best window inside them. */
const PLAY_FRAMES = 60 * 16;
const CLIP_FRAMES = 60 * 7;
/** Every second frame, at 33 ms (GIF rounds to 30 ms, so it runs a touch quick). */
const FRAME_STEP = 2;
const TRIES = 8;

// The kit runtime's object tables (templates/kit/engine.bas.hbs).
const EMPTY = 255;
const ROOMTOP = 16;

interface Thing {
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface View {
  hero: Thing | null;
  things: Thing[];
  frame: number;
  /** The room the game is in, from 1. */
  room: number;
}

type Pilot = (v: View) => JoystickInput;

const NONE: JoystickInput = { up: false, down: false, left: false, right: false, fire: false };

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cx = (t: Thing) => t.x + t.w / 2;
const cy = (t: Thing) => t.y + t.h / 2;

/** Shooter: line up under the lowest vacuum, fire, and step out from under the dust it drops. */
function shooterPilot(seed: number): Pilot {
  const r = rng(seed);
  let lean = r() * 8 - 4;
  return ({ hero, things, frame }) => {
    if (!hero) return NONE;
    if (frame % 90 === 0) lean = r() * 8 - 4;
    const hx = cx(hero);
    const bombs = things.filter((t) => t.type === "bomb" && t.y > hero.y - 56 && t.y < hero.y + hero.h);
    const threat = bombs.find((b) => Math.abs(cx(b) - hx) < hero.w / 2 + 6);
    if (threat) {
      const goLeft = cx(threat) > hx ? hero.x > 8 : hero.x > 140;
      return { ...NONE, left: goLeft, right: !goLeft };
    }
    const vacuums = things.filter((t) => t.type === "vacuum");
    if (vacuums.length === 0) return NONE;
    const lowest = Math.max(...vacuums.map((t) => t.y));
    const row = vacuums.filter((t) => t.y >= lowest - 2);
    const target = row.reduce((a, b) => (Math.abs(cx(a) - hx) < Math.abs(cx(b) - hx) ? a : b));
    const dx = cx(target) + lean - hx;
    const aligned = Math.abs(dx) < 4;
    const shotUp = things.some((t) => t.type === "shot");
    return { ...NONE, left: dx < -2, right: dx > 2, fire: aligned && !shotUp && frame % 4 < 2 };
  };
}

/** Teacup Rain: drift toward the nearest fish, away from columns with crockery coming down. */
function dodgerPilot(seed: number): Pilot {
  const r = rng(seed);
  const greed = 0.3 + r() * 0.5;
  return ({ hero, things }) => {
    if (!hero) return NONE;
    const hazards = things.filter((t) => (t.type === "teacup" || t.type === "teapot") && t.y < hero.y + hero.h && t.y > hero.y - 90);
    const fish = things.filter((t) => t.type === "fish" && t.y < hero.y + hero.h);
    const target = fish.sort((a, b) => b.y - a.y)[0];
    let best = hero.x;
    let bestCost = Infinity;
    for (let x = 0; x <= 160 - hero.w; x += 2) {
      let cost = Math.abs(x - hero.x) * 0.05;
      if (target) cost += Math.abs(x + hero.w / 2 - cx(target)) * greed;
      for (const h of hazards) {
        const overlap = h.x < x + hero.w + 6 && h.x + h.w > x - 6;
        if (overlap) cost += 400 - (hero.y - h.y) * 2;
      }
      // Passing under a teacup on the way there counts too.
      const lo = Math.min(x, hero.x);
      const hi = Math.max(x, hero.x) + hero.w;
      for (const h of hazards) if (h.y > hero.y - 30 && h.x < hi && h.x + h.w > lo) cost += 150;
      if (cost < bestCost) [best, bestCost] = [x, cost];
    }
    const dx = best - hero.x;
    return { ...NONE, left: dx < -1, right: dx > 1 };
  };
}

type Way = "left" | "right" | "up" | "down";

/** Maze games: a pixel-level search through the room to the next target, keeping clear of chasers. With nothing left to get, it heads for the room's exit. */
function mazePilot(game: KitGame, seed: number, opts: { chasers: string[]; food: string[]; power?: string; prey?: string; exits?: Record<number, Way> }): Pilot {
  const r = rng(seed);
  const W = 160;
  const H = ROOMTOP + game.room.rows.length * 16;
  const hero = game.types.find((t) => t.control?.axes === "4way")!;
  const freeMaps = new Map<number, Uint8Array>();
  const freeIn = (room: number) => {
    let free = freeMaps.get(room);
    if (free) return free;
    const rows = room > 1 ? game.rooms[room - 2]!.rows : game.room.rows;
    const wall = (px: number, py: number) => {
      const ch = rows[Math.floor((py - ROOMTOP) / 16)]?.[Math.floor(px / 8)];
      // Hazards cost a life in these games, so the autopilot treats them as walls.
      return ch === undefined || game.room.legend[ch] === "wall" || game.room.legend[ch] === "hazard";
    };
    free = new Uint8Array(W * H);
    for (let y = ROOMTOP; y + hero.height <= H; y++)
      for (let x = 0; x + hero.width <= W; x++) {
        let ok = true;
        for (let yy = y; ok && yy < y + hero.height; yy++) for (let xx = x; ok && xx < x + hero.width; xx++) if (wall(xx, yy)) ok = false;
        free[y * W + x] = ok ? 1 : 0;
      }
    freeMaps.set(room, free);
    return free;
  };
  const dirs = [
    [1, 0, "right"],
    [-1, 0, "left"],
    [0, 1, "down"],
    [0, -1, "up"],
  ] as const;
  const prev = new Int32Array(W * H);
  const radius = 18 + r() * 10;
  let stuck = 0;
  let lastPos = -1;
  let wander: JoystickInput | null = null;
  let wanderFor = 0;

  const search = (free: Uint8Array, start: number, goals: Set<number>, blocked: (i: number) => boolean): number => {
    prev.fill(-1);
    prev[start] = start;
    const queue = [start];
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q]!;
      if (goals.has(i)) {
        let j = i;
        while (prev[j] !== start && j !== start) j = prev[j]!;
        return j;
      }
      const x = i % W;
      const y = (i / W) | 0;
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx;
        if (prev[n] !== -1 || !free[n] || blocked(n)) continue;
        prev[n] = i;
        queue.push(n);
      }
    }
    return -1;
  };

  return ({ hero: h, things, room }) => {
    if (!h) return NONE;
    const free = freeIn(room);
    const start = h.y * W + h.x;
    if (start === lastPos) stuck++;
    else stuck = 0;
    lastPos = start;
    if (wanderFor > 0) {
      wanderFor--;
      return wander!;
    }
    if (stuck > 12) {
      const [, , d] = dirs[Math.floor(r() * 4)]!;
      wander = { ...NONE, [d]: true };
      wanderFor = 10;
      stuck = 0;
      return wander;
    }
    const chasers = things.filter((t) => opts.chasers.includes(t.type));
    const prey = opts.prey ? things.filter((t) => t.type === opts.prey) : [];
    const near = (t: Thing) => Math.hypot(cx(t) - cx(h), cy(t) - cy(h));
    let targets: Thing[];
    if (prey.length) targets = prey;
    else {
      const power = opts.power ? things.filter((t) => t.type === opts.power) : [];
      const danger = chasers.some((c) => near(c) < 50);
      targets = power.length && danger ? power : things.filter((t) => opts.food.includes(t.type));
      if (!targets.length) targets = power;
    }
    const goals = new Set<number>();
    const exit = opts.exits?.[room];
    if (!targets.length && exit) {
      // Already at the exit's edge: keep walking through it.
      const atEdge = { left: h.x === 0, right: h.x + h.w >= W, up: h.y === ROOMTOP, down: h.y + h.h >= H }[exit];
      if (atEdge) return { ...NONE, [exit]: true };
      for (let y = ROOMTOP; y + h.h <= H; y++)
        for (let x = 0; x + h.w <= W; x++) {
          const edge = { left: x === 0, right: x + h.w === W, up: y === ROOMTOP, down: y + h.h === H }[exit];
          if (edge && free[y * W + x]) goals.add(y * W + x);
        }
    }
    // Goals: any free hero position overlapping a target.
    for (const t of targets)
      for (let y = t.y - h.h + 2; y < t.y + t.h - 1; y++)
        for (let x = t.x - h.w + 2; x < t.x + t.w - 1; x++) if (x >= 0 && y >= 0 && x < W && y < H && free[y * W + x]) goals.add(y * W + x);
    const blocked = (rad: number) => (i: number) => {
      const x = i % W;
      const y = (i / W) | 0;
      return chasers.some((c) => Math.abs(cx(c) - (x + h.w / 2)) < rad && Math.abs(cy(c) - (y + h.h / 2)) < rad);
    };
    let step = search(free, start, goals, blocked(radius));
    if (step < 0) step = search(free, start, goals, blocked(10));
    if (step < 0) step = search(free, start, goals, () => false);
    if (step < 0) return NONE;
    const dx = (step % W) - h.x;
    const dy = ((step / W) | 0) - h.y;
    return { ...NONE, right: dx > 0, left: dx < 0, down: dy > 0, up: dy < 0 };
  };
}

function pilotFor(name: string, game: KitGame, seed: number): Pilot {
  switch (name) {
    case "shooter":
      return shooterPilot(seed);
    case "dodger":
      return dodgerPilot(seed);
    case "ghost-panic":
      return mazePilot(game, seed, { chasers: ["dust", "fast-dust"], food: ["yarn"], power: "catnip", prey: "scared" });
    case "key-quest":
      // Kitchen, then the hall for the key, then down to the pantry door and the sardines behind it.
      return mazePilot(game, seed, { chasers: ["robot"], food: ["key", "door", "sardines"], exits: { 1: "right", 2: "down", 3: "right" } });
    default:
      throw new Error(`No autopilot for ${name}`);
  }
}

interface Take {
  frames: Uint8Array[];
  score: number[];
  lives: number[];
  state: number[];
}

async function play(host: CoreHost, a78: Uint8Array, symbolTable: string, name: string, game: KitGame, seed: number): Promise<Take> {
  const sym = parseSymbols(symbolTable);
  const addr = (s: string) => {
    const a = sym.get(s);
    if (a === undefined) throw new Error(`No symbol ${s}`);
    return a;
  };
  const [scoreAt, livesAt, stateAt, roomAt, typeAt, xAt, yAt] = ["score0", "lives", "gamestate", "roomnum", "otype", "ox", "oy"].map(addr) as number[] as [number, number, number, number, number, number, number];
  const bcd = (b: Uint8Array) => Number([...b].map((v) => v.toString(16).padStart(2, "0")).join(""));
  await host.load(a78);
  host.step(30);
  host.setInput({ ...NONE, fire: true });
  host.step(2);
  host.setInput(NONE);
  host.step(2);

  const pilot = pilotFor(name, game, seed);
  const take: Take = { frames: [], score: [], lives: [], state: [] };
  for (let f = 0; f < PLAY_FRAMES; f++) {
    const types = host.readMemory(typeAt, MAX_OBJECTS);
    const xs = host.readMemory(xAt, MAX_OBJECTS);
    const ys = host.readMemory(yAt, MAX_OBJECTS);
    const things: Thing[] = [];
    let hero: Thing | null = null;
    for (let i = 0; i < MAX_OBJECTS; i++) {
      const t = types[i]!;
      if (t === EMPTY || !game.types[t]) continue;
      const k = game.types[t]!;
      const thing = { type: k.id, x: xs[i]!, y: ys[i]!, w: k.width, h: k.height };
      if (!hero && k.control) hero = thing;
      else things.push(thing);
    }
    host.setInput(pilot({ hero, things, frame: f, room: host.readMemory(roomAt)[0]! }));
    host.step(1);
    take.frames.push(host.indices());
    take.score.push(bcd(host.readMemory(scoreAt, 3)));
    take.lives.push(host.readMemory(livesAt)[0]!);
    take.state.push(host.readMemory(stateAt)[0]!);
  }
  return take;
}

/** One line of clips.json. Paths are relative to the manifest. */
interface ClipEntry {
  id: string;
  title: string;
  gif: string;
  still: string;
  width: number;
  height: number;
  seconds: number;
  /** Score at the clip's first and last frame. */
  score: [number, number];
}

/** The best clip-length window: most score, no lives lost, still playing at the end. */
function bestWindow(t: Take): { start: number; value: number } {
  let best = { start: 0, value: -Infinity };
  for (let s = 0; s + CLIP_FRAMES <= t.frames.length; s += 10) {
    const e = s + CLIP_FRAMES - 1;
    const lost = t.lives[s]! - t.lives[e]!;
    const playing = t.state.slice(s, e + 1).every((v) => v === 1);
    // A win is a fine ending, so long as the screen spends most of the clip in play.
    const won = t.state[e] === 2 && t.state.slice(s, e - 90).every((v) => v === 1);
    const value = t.score[e]! - t.score[s]! - lost * 1000 - (playing || won ? 0 : 5000) - s * 0.01;
    if (value > best.value) best = { start: s, value };
  }
  return best;
}

const only = process.env.CLIPS?.split(",");
const names = fs
  .readdirSync(gamesDir)
  .filter((f) => f.endsWith(".json") && !f.endsWith(".tests.json"))
  .map((f) => f.replace(/\.json$/, ""))
  .filter((n) => !only || only.includes(n));

it(
  "makes the landing page clips",
  async () => {
    const builder = await nodeBuilder();
    const host = await nodeHost();
    fs.mkdirSync(outDir, { recursive: true });
    // Kept across partial runs (CLIPS=…): entries for games not remade stay as they were.
    const manifestPath = path.join(outDir, "clips.json");
    const manifest: Record<string, ClipEntry> = fs.existsSync(manifestPath)
      ? Object.fromEntries((JSON.parse(fs.readFileSync(manifestPath, "utf8")) as ClipEntry[]).map((e) => [e.id, e]))
      : {};
    for (const name of names) {
      const game = KitGameSchema.parse(JSON.parse(fs.readFileSync(path.join(gamesDir, `${name}.json`), "utf8")));
      const rom = await buildKitRom(game, SOUND_LIBRARY, builder);
      if (!rom.ok) throw new Error(`${name}: ${rom.failure}`);
      let pick: { take: Take; start: number; value: number; seed: number } | null = null;
      for (let seed = 1; seed <= TRIES; seed++) {
        const take = await play(host, rom.a78, rom.symbols, name, game, seed);
        const w = bestWindow(take);
        if (process.env.CLIPS_TRACE)
          process.stdout.write(`  ${name} try ${seed}: ${take.score.filter((_, i) => i % 60 === 0).join(" ")} | lives ${take.lives.filter((_, i) => i % 60 === 0).join("")} | best ${w.value.toFixed(0)}@${w.start}\n`);
        if (!pick || w.value > pick.value) pick = { take, ...w, seed };
      }
      const { take, start, seed } = pick!;
      const end = start + CLIP_FRAMES - 1;
      const frames = take.frames.slice(start, start + CLIP_FRAMES).filter((_, i) => i % FRAME_STEP === 0);
      const gif = encodeClip(frames, { palette: host.paletteRgb, delayMs: (1000 / 60) * FRAME_STEP, scale: 1 });
      fs.writeFileSync(path.join(outDir, `${name}.gif`), gif);

      // A still for reduced motion: the frame a second before the end, through the palette.
      const still = take.frames[end - 60]!;
      const rgba = new Uint8Array(CLIP_WIDTH * CLIP_HEIGHT * 4);
      const p = host.paletteRgb;
      for (let i = 0; i < still.length; i++) rgba.set([p[still[i]! * 3]!, p[still[i]! * 3 + 1]!, p[still[i]! * 3 + 2]!, 255], i * 4);
      fs.writeFileSync(path.join(outDir, `${name}.png`), encodeRgbaPng(CLIP_WIDTH, CLIP_HEIGHT, rgba));

      manifest[name] = {
        id: name,
        title: game.title,
        gif: `${name}.gif`,
        still: `${name}.png`,
        width: CLIP_WIDTH,
        height: CLIP_HEIGHT,
        seconds: CLIP_FRAMES / 60,
        score: [take.score[start]!, take.score[end]!],
      };
      process.stdout.write(
        `${name}: seed ${seed}, frames ${start}-${end}, score ${take.score[start]}→${take.score[end]}, ` +
          `lives ${take.lives[start]}→${take.lives[end]}, state ${take.state[end]}, ${(gif.length / 1024).toFixed(0)} KB\n`,
      );
    }
    const entries = Object.values(manifest).sort((a, b) => a.id.localeCompare(b.id));
    fs.writeFileSync(manifestPath, JSON.stringify(entries, null, 2) + "\n");
  },
  20 * 60_000,
);
