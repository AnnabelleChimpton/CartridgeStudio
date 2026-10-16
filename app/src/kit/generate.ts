// Kit code generation: validates a kit game, then renders the generic runtime
// with the game's data tables, rule checks, draw routines, text and sounds.

import Handlebars from "handlebars";
import { encodeIndexedPng, type BuildInput } from "@cartridge-studio/toolchain";
import { lintBasic } from "../codegen/lint.ts";
import { sanitizeTitle, soundData } from "../codegen/generate.ts";
import type { SoundEffect } from "../project/schema.ts";
import {
  BEHAVIOURS,
  FONT_CHARS,
  KitGameSchema,
  MAX_OBJECTS,
  PLAYER_BEHAVIOURS,
  ROOM_COLS,
  ROOM_ROWS,
  type KitAction,
  type KitGame,
  type KitTrigger,
} from "./schema.ts";
import { fontRows } from "./font.ts";
import kitEngine from "@cartridge-studio/templates/kit/engine.bas.hbs?raw";

export const KIT_RUNTIME_VERSION = "0.1.0";
const ROOMTOP = 16;
/** Pixels per frame for speed 1-4, by frame phase (frame & 3). */
const SPEED_STEPS = [
  [1, 0, 0, 0],
  [1, 0, 1, 0],
  [1, 1, 1, 1],
  [2, 2, 2, 2],
];
/** Objects one zone (8 lines) can hold, besides the walls and HUD. Measured, see docs/kit-spike-findings.md. */
export const ZONE_BUDGET = 12;

/**
 * Frame-time cost model, calibrated from measurements in js7800 and MAME
 * (docs/kit-spike-findings.md). A game whose total is at most 100 runs at
 * 60 fps; the fuzz test checks that this stays true.
 */
export const CPU_BUDGET = 100;
const BEHAVIOUR_COST: Record<string, number> = {
  still: 4,
  march: 4.5,
  fall: 5,
  "patrol-h": 6,
  "patrol-v": 6,
  bounce: 9,
  chase: 9,
  "player-lr": 6,
  "player-4way": 6,
  "player-8way": 6,
  "projectile-up": 6,
  "projectile-down": 6,
};
/** Each display zone (8 lines) a sprite spans beyond the first. */
const EXTRA_ZONE_COST = 1.5;
/** Rolling the dice for a dropper, every frame. */
const DROPPER_COST = 0.5;
const TOUCH_RULE_COST = 2;
/** Per pair of objects a touch rule compares (outer × inner). */
const TOUCH_RULE_COST_PER_PAIR = 0.6;
const EVENT_RULE_COST = 1;
const EVENT_RULE_COST_PER_OBJECT = 0.2;

/** Estimated share of a frame the game needs (100 = all of it). */
export function cpuCost(g: KitGame, spawns: { type: number }[]): number {
  const id = new Map(g.types.map((t, i) => [t.id, i]));
  const launched = new Set(g.types.flatMap((t) => [t.shoots, t.drops?.type]).filter((x): x is string => !!x));
  const population = (t: number) => spawns.filter((s) => s.type === t).length + (launched.has(g.types[t]!.id) ? 1 : 0);
  let cost = 0;
  g.types.forEach((t, i) => {
    const each = BEHAVIOUR_COST[t.behaviour]! + EXTRA_ZONE_COST * (Math.ceil(t.height / 8) - 1) + (t.drops ? DROPPER_COST : 0);
    cost += population(i) * each;
  });
  for (const r of g.rules) {
    const w = r.when;
    if ("touch" in w) {
      // The runtime loops over the scarcer side and checks every object of the other.
      const [a, b] = w.touch.map((x) => population(id.get(x)!)) as [number, number];
      cost += TOUCH_RULE_COST + TOUCH_RULE_COST_PER_PAIR * Math.max(1, Math.min(a, b)) * Math.max(a, b);
    } else {
      const t = "allGone" in w ? w.allGone : "reachesBottom" in w ? w.reachesBottom : null;
      cost += EVENT_RULE_COST + EVENT_RULE_COST_PER_OBJECT * (t ? population(id.get(t)!) : 0);
    }
  }
  return Math.round(cost);
}

export type KitResult = { ok: true; input: BuildInput & { files: Record<string, Uint8Array> } } | { ok: false; errors: string[] };

/** Text the font can draw, uppercased and trimmed to a screen line. */
export const kitText = (s: string, max = 32) =>
  [...s.toUpperCase()].filter((c) => FONT_CHARS.includes(c) && c !== "#").join("").trim().slice(0, max);

interface Spawn {
  type: number;
  x: number;
  y: number;
}

export function validateKit(input: unknown, library: SoundEffect[]): { ok: true; game: KitGame; spawns: Spawn[] } | { ok: false; errors: string[] } {
  const parsed = KitGameSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `This game file is damaged (${i.path.join(".")}: ${i.message}).`) };
  }
  const g = parsed.data;
  const errors: string[] = [];
  const typeIndex = new Map(g.types.map((t, i) => [t.id, i]));
  const paletteIds = new Set(g.palettes.map((p) => p.id));

  if (typeIndex.size !== g.types.length) errors.push("Two kinds of thing have the same name.");
  for (const p of [g.wallPalette, g.textPalette]) if (!paletteIds.has(p)) errors.push(`There's no palette called "${p}".`);
  for (const t of g.types) {
    if (!paletteIds.has(t.palette)) errors.push(`"${t.label}" uses a palette that doesn't exist.`);
    t.frames.forEach((f, n) => {
      if (f.length !== t.height || f.some((r) => r.length !== t.width || !/^[0-3]*$/.test(r))) {
        errors.push(`The pixels of "${t.label}" (frame ${n + 1}) are damaged.`);
      }
    });
    if (t.shoots && !typeIndex.has(t.shoots)) errors.push(`"${t.label}" shoots something that doesn't exist.`);
    if (t.shoots && !PLAYER_BEHAVIOURS.includes(t.behaviour)) errors.push(`Only the player can shoot ("${t.label}" can't).`);
    if (t.drops && !typeIndex.has(t.drops.type)) errors.push(`"${t.label}" drops something that doesn't exist.`);
  }

  // Room: walls and where things start.
  const spawns: Spawn[] = [];
  if (g.room.rows.length !== ROOM_ROWS || g.room.rows.some((r) => r.length !== ROOM_COLS)) {
    errors.push(`The room must be ${ROOM_COLS} squares wide and ${ROOM_ROWS} tall.`);
  } else {
    g.room.rows.forEach((row, r) => {
      [...row].forEach((ch, c) => {
        if (ch === " " || ch === ".") return;
        const what = g.room.legend[ch];
        if (!what) errors.push(`The room uses "${ch}", which doesn't stand for anything.`);
        else if (what !== "wall") {
          const t = typeIndex.get(what);
          if (t === undefined) errors.push(`The room places "${what}", which doesn't exist.`);
          else spawns.push({ type: t, x: c * 8, y: ROOMTOP + r * 16 });
        }
      });
    });
  }
  const players = spawns.filter((s) => PLAYER_BEHAVIOURS.includes(g.types[s.type]!.behaviour)).length;
  if (players > 1) errors.push("Only one player can be in the room.");
  if (spawns.length === 0) errors.push("Put at least one thing in the room.");
  const launchers = g.types.filter((t) => t.shoots || t.drops).length;
  if (spawns.length + launchers > MAX_OBJECTS) {
    errors.push(`A room can hold ${MAX_OBJECTS - launchers} things here; this one has ${spawns.length}.`);
  }
  // Zone budget: objects whose top-left lands in the same 16-line room row.
  for (let r = 0; r < ROOM_ROWS; r++) {
    const n = spawns.filter((s) => s.y === ROOMTOP + r * 16).length;
    if (n > ZONE_BUDGET) errors.push(`Row ${r + 1} of the room has ${n} things; the console can show ${ZONE_BUDGET} side by side.`);
  }

  // Rules.
  const refType = (id: string, where: string) => !typeIndex.has(id) && errors.push(`${where} mentions "${id}", which doesn't exist.`);
  g.rules.forEach((rule, n) => {
    const where = `Rule ${n + 1}`;
    const w = rule.when;
    if ("touch" in w) w.touch.forEach((id) => refType(id, where));
    if ("allGone" in w) refType(w.allGone, where);
    if ("reachesBottom" in w) refType(w.reachesBottom, where);
    for (const a of rule.then) {
      const who = "remove" in a ? a.remove : "respawn" in a ? a.respawn : null;
      if (who === "second" && !("touch" in w)) errors.push(`${where} removes or moves a second thing, but only touching involves two.`);
      if (who === "first" && !("touch" in w) && !("reachesBottom" in w)) errors.push(`${where} has no thing to remove or move.`);
      if ("sound" in a && !library.some((s) => s.id === a.sound)) errors.push(`${where} plays a sound that isn't in the library.`);
    }
    if ("reachesBottom" in w) {
      const settles = rule.then.some((a) => "remove" in a || "respawn" in a || "win" in a || "lose" in a || "restartRoom" in a);
      if (!settles) errors.push(`${where}: something reaching the bottom must be removed or moved back, or end the game.`);
    }
  });
  if (g.sounds.shoot && !library.some((s) => s.id === g.sounds.shoot)) errors.push("The shooting sound isn't in the library.");

  if (!errors.length) {
    const cost = cpuCost(g, spawns);
    if (cost > CPU_BUDGET) {
      errors.push(`This room is too busy for the console to run smoothly (it needs ${cost}% of each frame). Remove some things or rules.`);
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, game: g, spawns };
}

function dataTable(name: string, values: number[]): string {
  const rows: string[] = [];
  for (let i = 0; i < values.length; i += 20) rows.push(` ${values.slice(i, i + 20).join(", ")}`);
  return ` data ${name}\n${rows.join("\n")}\nend`;
}

const triggerText = (w: KitTrigger) =>
  "touch" in w
    ? `${w.touch[0]} touches ${w.touch[1]}`
    : "allGone" in w
      ? `all ${w.allGone} are gone`
      : "reachesBottom" in w
        ? `a ${w.reachesBottom} reaches the bottom`
        : `${w.timer} seconds pass`;

export function generateKit(input: unknown, library: SoundEffect[]): KitResult {
  const v = validateKit(input, library);
  if (!v.ok) return v;
  const { game: g } = v;
  // Placed objects are sorted by type, so each type has its own slot range;
  // launched ones (shots, bombs, drops) use the slots after them.
  const spawns = [...v.spawns].sort((a, b) => a.type - b.type);
  const launchStart = spawns.length;
  const launchedTypes = new Set(g.types.flatMap((t) => [t.shoots, t.drops?.type]).filter((x): x is string => !!x));
  /** First and last slot that can hold objects of type t. */
  const slots = (t: number): [number, number] => {
    const placed = spawns.map((s, i) => [s.type, i] as const).filter(([type]) => type === t).map(([, i]) => i);
    const launched = launchedTypes.has(g.types[t]!.id);
    if (placed.length === 0) return launched ? [launchStart, 23] : [launchStart, launchStart - 1];
    return [placed[0]!, launched ? 23 : placed.at(-1)!];
  };
  const typeIndex = new Map(g.types.map((t, i) => [t.id, i]));
  const paletteIndex = new Map(g.palettes.map((p, i) => [p.id, i]));
  const files: Record<string, Uint8Array> = {};
  const usedSounds = new Map<string, SoundEffect>();
  const sound = (id: string) => {
    usedSounds.set(id, library.find((s) => s.id === id)!);
    return `playsfx sfx_${id.replace(/-/g, "_")}`;
  };

  // Graphics: one PNG per frame, consecutive so `plotsprite name pal x y frame` animates; then the font.
  const graphics: string[] = [];
  g.types.forEach((t, k) => {
    t.frames.forEach((f, n) => {
      const name = n === 0 ? `spr${k}` : `spr${k}_${n}`;
      files[`${name}.png`] = encodeIndexedPng(f);
      graphics.push(` rem ${t.label}${n ? ` frame ${n + 1}` : ""}\n incgraphic ${name}.png 160A 0 1 2 3`);
    });
  });
  files["font.png"] = encodeIndexedPng(fontRows(FONT_CHARS));
  graphics.push(" incgraphic font.png 160A 0 1 2 3");

  const palettes = g.palettes
    .map((p, i) => ` rem palette ${p.id}\n P${i}C1 = ${p.colors[0]} : P${i}C2 = ${p.colors[1]} : P${i}C3 = ${p.colors[2]}`)
    .join("\n");

  // Draw routines, one per type.
  const drawRoutines = g.types
    .map(
      (t, k) =>
        // 4-byte sprite objects: every kit sprite is 160A, so none needs its own mode byte.
        // (The inline PLOTSPRITE4 macro is faster still, but skips off-screen checks.)
        `draw${k}\n rem ${t.label}\n plotsprite4 spr${k} ${paletteIndex.get(t.palette)} px py${t.frames.length > 1 ? " animframe" : ""}\n return`,
    )
    .join("\n\n");

  // Rules.
  const ruleCode: string[] = [" ruleexit = 0", " rnd = frame & 1"];
  /** Which loop variable holds each rule's first and second thing. */
  const roles = new Map<number, { first: string; second: string }>();
  /** Most objects of a type there can be: placed ones, or one if something shoots or drops it. */
  const population = (t: number) => {
    const placed = spawns.filter((s) => s.type === t).length;
    const launched = g.types.some((x) => x.shoots === g.types[t]!.id || x.drops?.type === g.types[t]!.id) ? 1 : 0;
    return placed + launched;
  };
  let latch = 0;
  g.rules.forEach((rule, n) => {
    const w = rule.when;
    const L = `r${n}`;
    const out: string[] = [` rem rule ${n + 1}: when ${triggerText(w)}`];
    if ("touch" in w) {
      // The outer loop runs over the scarcer type: the player (one known slot)
      // or whichever type has fewer objects. Actions still see the rule's
      // first thing as `first`.
      const first = typeIndex.get(w.touch[0])!;
      const second = typeIndex.get(w.touch[1])!;
      const swap = population(second) < population(first);
      const outer = swap ? second : first;
      const inner = swap ? first : second;
      roles.set(n, swap ? { first: "oj", second: "oi" } : { first: "oi", second: "oj" });
      const to = g.types[outer]!;
      const tn = g.types[inner]!;
      const outerIsHero = PLAYER_BEHAVIOURS.includes(to.behaviour);
      const [os, oe] = slots(outer);
      const [is, ie] = slots(inner);
      if (oe < os || ie < is) {
        out.push(` rem (never true: no ${oe < os ? to.label : tn.label} can exist)`);
        ruleCode.push(out.join("\n"));
        return;
      }
      out.push(
        ...(outerIsHero
          ? [` oi = heroi`, ` if oi = EMPTY then goto ${L}_ni`, ` if otype[oi] <> ${outer} then goto ${L}_ni`]
          : [` for oi = ${os} to ${oe}`, ` if otype[oi] <> ${outer} then goto ${L}_ni`]),
        ` x1 = ox[oi] : y1 = oy[oi]`,
        ` for oj = ${is} to ${ie}`,
        ` if otype[oj] <> ${inner} then goto ${L}_nj`,
        ...(outer === inner ? [` if oj = oi then goto ${L}_nj`] : []),
        ` x2 = ox[oj] : y2 = oy[oj]`,
        ` if boxcollision(x1, y1, ${to.width}, ${to.height}, x2, y2, ${tn.width}, ${tn.height}) then gosub ${L}_do`,
        ` if ruleexit then return`,
        ` if otype[oi] <> ${outer} then goto ${L}_ni`,
        `${L}_nj`,
        ` next`,
        `${L}_ni`,
        ...(outerIsHero ? [] : [` next`]),
      );
    } else if ("reachesBottom" in w) {
      const a = typeIndex.get(w.reachesBottom)!;
      const [as, ae] = slots(a);
      // Event rules run on odd frames only: a frame's delay doesn't show, and it halves their cost.
      out.push(
        ` if rnd = 0 then goto ${L}_ni2`,
        ` for oi = ${as} to ${Math.max(as, ae)}`,
        ` if otype[oi] <> ${a} then goto ${L}_ni`,
        ` y1 = oy[oi] + ${g.types[a]!.height}`,
        ` if y1 >= 190 then gosub ${L}_do`,
        ` if ruleexit then return`,
        `${L}_ni`,
        ` next`,
        `${L}_ni2`,
      );
    } else {
      // Event rules fire once each time their condition becomes true.
      const bit = latch++;
      const reg = bit < 8 ? "latches" : "latches2";
      const flag = `${reg}{${bit % 8}}`;
      out.push(` if rnd = 0 then goto ${L}_end`);
      if ("allGone" in w) {
        const a = typeIndex.get(w.allGone)!;
        const [as, ae] = slots(a);
        out.push(
          ` count = 0`,
          ` for oj = ${as} to ${Math.max(as, ae)}`,
          ` if otype[oj] = ${a} then count = count + 1`,
          ` next`,
          ` if count > 0 then ${flag} = 0 : goto ${L}_end`,
        );
      } else {
        out.push(` if seconds <> ${w.timer} then ${flag} = 0 : goto ${L}_end`);
      }
      out.push(` if ${flag} then goto ${L}_end`, ` ${flag} = 1`, ` gosub ${L}_do`, ` if ruleexit then return`, `${L}_end`);
    }
    out.push(` if gamestate <> STATE_PLAY then return`);
    ruleCode.push(out.join("\n"));
  });
  const ruleBodies = g.rules.map((rule, n) => {
    const role = roles.get(n) ?? { first: "oi", second: "oj" };
    const body = rule.then.map((a: KitAction) => {
      if ("remove" in a) return ` otype[${role[a.remove]}] = EMPTY`;
      if ("respawn" in a) {
        const x = role[a.respawn];
        return ` ox[${x}] = osx[${x}] : oy[${x}] = osy[${x}]`;
      }
      if ("score" in a) return ` score0 = score0 + ${a.score}`;
      if ("loseLife" in a) return ` gosub loselife`;
      if ("win" in a) return ` gamestate = STATE_WON : ruleexit = 1`;
      if ("lose" in a) return ` gamestate = STATE_LOST : ruleexit = 1`;
      if ("restartRoom" in a) return ` gosub startroom : ruleexit = 1`;
      return ` ${sound(a.sound)}`;
    });
    return `r${n}_do\n${body.join("\n")}\n return`;
  });

  // Text, centred; y is in zones (8 lines).
  const textLine = (s: string, y: number) => {
    const t = kitText(s);
    if (!t) return "";
    return ` plotchars '${t}' ${paletteIndex.get(g.textPalette)} ${Math.floor((160 - t.length * 4) / 2)} ${y}`;
  };

  // Data.
  const room = g.room.rows.map((r) => r.replace(/\./g, " "));
  const isWall = (ch: string) => g.room.legend[ch] === "wall";
  const mapLines = room.flatMap((r) => {
    const line = [...r].map((ch) => (isWall(ch) ? "##" : "  ")).join("");
    return [line, line]; // each 16-line room row is two 8-line character rows
  });
  const data = [
    dataTable("typew", g.types.map((t) => t.width)),
    dataTable("typeh", g.types.map((t) => t.height)),
    dataTable("typebeh", g.types.map((t) => BEHAVIOURS.indexOf(t.behaviour))),
    dataTable("typespeed", g.types.map((t) => t.speed - 1)),
    dataTable("typeshoots", g.types.map((t) => (t.shoots ? typeIndex.get(t.shoots)! : 255))),
    dataTable("typedrops", g.types.map((t) => (t.drops ? typeIndex.get(t.drops.type)! : 255))),
    dataTable("typedropchance", g.types.map((t) => t.drops?.chance ?? 0)),
    dataTable("speedsteps", SPEED_STEPS.flat()),
    dataTable("roomwalls", room.flatMap((r) => [...r].map((ch) => (isWall(ch) ? 1 : 0)))),
    dataTable("rowoffset", Array.from({ length: ROOM_ROWS }, (_, r) => r * ROOM_COLS)),
    dataTable("spawntype", spawns.map((s) => s.type)),
    dataTable("spawnx", spawns.map((s) => s.x)),
    dataTable("spawny", spawns.map((s) => s.y)),
    ` alphadata roommap font\n${mapLines.map((l) => ` '${l}'`).join("\n")}\nend`,
  ].join("\n\n");

  const shootSound = g.sounds.shoot ? sound(g.sounds.shoot) : "rem no shooting sound";
  const soundBlocks = [...usedSounds].map(([id, sfx]) => soundData(`sfx_${id.replace(/-/g, "_")}`, sfx)).join("\n\n");

  const source = Handlebars.create()
    .compile(kitEngine, { noEscape: true, strict: true, ignoreStandalone: true })({
      title: sanitizeTitle(g.title),
      runtimeVersion: KIT_RUNTIME_VERSION,
      lives: g.lives,
      constants: ` const spawncount_minus1 = ${spawns.length - 1}\n const LAUNCHSTART = ${Math.min(launchStart, 23)}\n const typecount_minus1 = ${g.types.length - 1}\n autodim byte ruleexit`,
      hasDrops: g.types.some((t) => t.drops),
      graphics: graphics.join("\n"),
      alphachars: FONT_CHARS,
      palettes,
      background: g.background,
      textPalette: paletteIndex.get(g.textPalette),
      wallPalette: paletteIndex.get(g.wallPalette),
      showTimer: g.rules.some((r) => "timer" in r.when),
      hasWalls: room.some((r) => [...r].some(isWall)),
      drawLabels: g.types.map((_, k) => `draw${k}`).join(" "),
      shootSound,
      rules: ruleCode.join("\n\n"),
      ruleActions: ruleBodies.join("\n\n"),
      drawRoutines,
      titleText: [textLine(g.text.title, 9), textLine("PRESS FIRE", 12)].filter(Boolean).join("\n") || " rem no title",
      winText: textLine(g.text.win, 11) || " rem no win text",
      loseText: textLine(g.text.lose, 11) || " rem no lose text",
      dataTables: data,
      soundData: soundBlocks,
    })
    .replace(/\n{3,}/g, "\n\n");

  const lint = lintBasic(source);
  if (lint.length) return { ok: false, errors: lint.map((l) => `Runtime error on line ${l.line}: ${l.message}`) };
  return { ok: true, input: { source, files } };
}
