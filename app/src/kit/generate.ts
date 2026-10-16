// Kit code generation (kit model v2): validate → a typed IR (ir.ts) → emit
// 7800basic (emit.ts) into the runtime template. The cost model lives here
// too: it prices a game from its IR, part by part, and generation refuses a
// game that wouldn't hold 60 fps.

import Handlebars from "handlebars";
import { encodeIndexedPng, type BuildInput } from "@cartridge-studio/toolchain";
import { lintBasic } from "../codegen/lint.ts";
import { sanitizeTitle, soundData } from "../codegen/generate.ts";
import type { SoundEffect } from "../project/schema.ts";
import { FONT_CHARS, type KitGame } from "./schema.ts";
import { fontRows } from "./font.ts";
import { emitKit } from "./emit.ts";
import { ROOMTOP, ZONE_BUDGET, kitText, lowerKit, turnReach, type IR, type IRRule, type Span } from "./ir.ts";
import { ruleSentence } from "./sentence.ts";
import kitEngine from "@cartridge-studio/templates/kit/engine.bas.hbs?raw";

export { ZONE_BUDGET, kitText, turnReach };
export const KIT_RUNTIME_VERSION = "0.4.0";

/**
 * Frame-time cost model, in points of a frame (100 = all of it), calibrated
 * from measurements in js7800 (kit-measure.test.ts). A game whose total is at most 100 runs at 60 fps; the
 * fuzz test checks that this stays true.
 */
export const CPU_BUDGET = 100;
export const COST = {
  /** The runtime's own work every frame: input, the score and lives, drawing the screen. */
  runtime: 6,
  /** Drawing a thing (every thing), and each display zone it spans beyond the first. */
  draw: 1.5,
  extraZone: 0.5,
  /** Velocity along one axis, with wall and edge checks: on alternate frames, or every frame. */
  axisSliced: 2.5,
  axisEveryFrame: 4,
  /** Without wall checks (walls "through", or a room with no walls), each axis costs this share. */
  noWalls: 0.6,
  /** No checks at all (walls "through", edges "pass"), per axis. */
  axisFree: 0.8,
  control: 0.5,
  steer: 0.5,
  /** Steering toward the nearest of several, per candidate. */
  nearestPerThing: 0.7,
  gravity: 0.5,
  facing: 1,
  /** Rules. A rule about each thing of a kind costs per thing, every frame it's checked. */
  touch: 1,
  /** Per thing of the scarcer kind (the outer loop), and per pair compared. */
  touchPerOuter: 0.5,
  touchPerPair: 0.75,
  tile: 0.5,
  tilePerThing: 1.1,
  perThingState: 0.5,
  /** At an edge, against a wall, leaving the screen: per thing, plus per side checked. */
  perThingStatePerThing: 0.25,
  perSide: 0.3,
  event: 0.3,
  every: 0.3,
  everyFrame: 0.5,
  test: 0.5,
  condition: 0.3,
  /** Values that loop over things (count of X), per thing. */
  countPerThing: 0.3,
  /** Actions, priced only on rules that can fire every frame. */
  action: 0.5,
  actionPerTarget: 0.5,
  create: 1.5,
  /** Numbers on screen beyond the first two (the score and lives were in every measured game). */
  hudNumber: 2.6,
  timers: 1.7,
  sweepPerThing: 0.5,
};

/** One line of the cost estimate: what it is and its points. */
export interface CostItem {
  what: string;
  points: number;
  span?: Span;
}

/** Points per thing of a kind, by its parts. */
function kindCost(ir: IR, k: number): number {
  const t = ir.types[k]!;
  let c = COST.draw + COST.extraZone * (Math.ceil(t.height / 8) - 1);
  const axes = Number(t.axes.x) + Number(t.axes.y);
  if (axes) {
    const free = t.move.edge === "pass" && (t.move.wall === "through" || !ir.features.walls);
    const walls = t.move.wall !== "through" && ir.features.walls;
    c += axes * (free ? COST.axisFree : (t.move.sliced ? COST.axisSliced : COST.axisEveryFrame) * (walls ? 1 : COST.noWalls));
  }
  if (t.control) c += COST.control;
  if (t.steer) {
    const target = ir.types[t.steer.target]!;
    c += COST.steer + (target.loop[1] > target.loop[0] ? COST.nearestPerThing * target.population : 0);
  }
  if (t.gravity) c += COST.gravity;
  if (t.uses.facing) c += COST.facing;
  return c;
}

/** Rules whose actions can run every frame; other rules' actions are rare (measured in js7800) and aren't priced. */
const frequent = (r: IRRule) => r.trigger.k === "every" && r.trigger.frames && r.trigger.n <= 2;

/** The estimate, line by line. */
export function costItems(ir: IR): CostItem[] {
  const items: CostItem[] = [{ what: "The runtime", points: COST.runtime }];
  const pop = (k: number) => ir.types[k]!.population;
  const own = (k: number) => ir.types[k]!.own[1] - ir.types[k]!.own[0] + 1;
  const reach = ir.types.map((t) => [t.index, ...ir.types.filter((u) => u.from.includes(t.index)).map((u) => u.index)]);
  ir.types.forEach((t) => {
    // A thing that can turn into something busier is priced as the busiest thing it can be.
    const each = Math.max(...reach[t.index]!.map((u) => kindCost(ir, u)));
    if (own(t.index) > 0) items.push({ what: `${own(t.index)} × ${t.label}`, points: own(t.index) * each, span: t.span });
  });
  const valueCost = (vs: { src: { k: string; type?: number } }[]) => vs.reduce((n, v) => n + (v.src.k === "count" ? COST.countPerThing * pop(v.src.type!) : 0), 0);
  for (const r of ir.rules) {
    let c = COST.condition * (r.pre.length + r.post.length) + valueCost([...r.pre, ...r.post].flatMap((x) => [x.a, x.b]));
    const tr = r.trigger;
    if (tr.k === "touch") {
      const [a, b] = [pop(tr.a), pop(tr.b)];
      c += COST.touch + COST.touchPerOuter * Math.min(a, b) + COST.touchPerPair * Math.max(1, Math.min(a, b)) * Math.max(a, b);
    } else if (tr.k === "tile") c += COST.tile + COST.tilePerThing * pop(tr.type);
    else if (tr.k === "edge" || tr.k === "wall" || tr.k === "leaves") {
      const sides = tr.k === "leaves" ? 4 : tr.k === "wall" ? 1 : tr.sides.length;
      c += COST.perThingState + (COST.perThingStatePerThing + COST.perSide * sides) * pop(tr.type);
    }
    else if (tr.k === "every") c += tr.frames ? COST.everyFrame : COST.every;
    else if (tr.k === "test") c += COST.test + valueCost([tr.cmp.a, tr.cmp.b]);
    else if (tr.k === "after") c += COST.test;
    else if (tr.k === "button" || tr.k === "pushed" || tr.k === "message") c += COST.event;
    if (frequent(r)) {
      for (const a of r.actions) {
        c += a.k === "create" ? COST.create : COST.action;
        if ("who" in a && typeof a.who === "object" && a.who.k === "every") c += COST.actionPerTarget * pop(a.who.type);
      }
    }
    if (c > 0) items.push({ what: `Rule ${r.n}`, points: c, span: r.span });
  }
  const extraHud = Math.max(0, ir.hud.length - 2) + ir.flow.end.show.length * 0;
  if (extraHud) items.push({ what: "Numbers on screen", points: extraHud * COST.hudNumber });
  if (ir.features.timers || ir.features.protect) items.push({ what: "Timers", points: COST.timers });
  const sweeps = ir.types.filter((t) => t.move.edge === "pass" && t.uses.leavesRule);
  for (const t of sweeps) items.push({ what: `${t.label} leaving the screen`, points: COST.sweepPerThing * t.population, span: t.span });
  const hooks = [ir.code.init, ir.code.frame, ir.code.draw].filter((s) => s.trim()).length + ir.types.filter((t) => t.hook).length;
  if (hooks) items.push({ what: "Your code", points: hooks * ir.code.cost });
  return items;
}

/** Estimated share of a frame the game needs (100 = all of it). The second argument is ignored (kept for older callers). */
export function cpuCost(g: KitGame | unknown, _spawns?: unknown): number {
  const low = lowerKit(g, null, {});
  return low.ok ? irCost(low.ir) : 0;
}

export const irCost = (ir: IR) => Math.round(costItems(ir).reduce((n, i) => n + i.points, 0));

export interface Spawn {
  type: number;
  x: number;
  y: number;
}

export interface KitOptions {
  /** Skip the CPU budget check (cost measurements only). */
  ignoreBudget?: boolean;
  /** Things nobody controls update every frame instead of on alternate frames (cost measurements only). */
  velocityEveryFrame?: boolean;
}

export type KitValidation = { ok: true; game: KitGame; spawns: Spawn[]; ir: IR } | { ok: false; errors: string[] };

export function validateKit(input: unknown, library: SoundEffect[], opts: KitOptions = {}): KitValidation {
  const low = lowerKit(input, library, { everyFrame: opts.velocityEveryFrame });
  if (!low.ok) return low;
  const { ir, game } = low;
  if (!opts.ignoreBudget) {
    const cost = irCost(ir);
    if (cost > CPU_BUDGET) {
      return { ok: false, errors: [`This room is too busy for the console to run smoothly (it needs ${cost}% of each frame). Remove some things or rules.`] };
    }
  }
  const spawns = ir.rooms[0]!.spawns.map((s) => ({ type: s.type, x: s.x, y: s.y }));
  return { ok: true, game, spawns, ir };
}

/** Where each rule, action, thing and room landed in the generated code (1-based, inclusive lines). */
export interface SourceSpan extends Span {
  from: number;
  to: number;
}

export type KitResult =
  | { ok: true; input: BuildInput & { files: Record<string, Uint8Array> }; ir: IR; spans: SourceSpan[] }
  | { ok: false; errors: string[] };

/** Strips the emitter's `@@span` markers, recording the lines between them. */
function takeSpans(marked: string): { source: string; spans: SourceSpan[] } {
  const out: string[] = [];
  const open: { span: Span; from: number }[] = [];
  const spans: SourceSpan[] = [];
  for (const line of marked.split("\n")) {
    const m = /^@@span (\w+):(.*)$/.exec(line);
    if (m) {
      open.push({ span: { kind: m[1] as Span["kind"], id: m[2]! }, from: out.length + 1 });
      continue;
    }
    if (line === "@@end") {
      const o = open.pop();
      if (o && out.length >= o.from) spans.push({ ...o.span, from: o.from, to: out.length });
      continue;
    }
    out.push(line);
  }
  return { source: out.join("\n"), spans };
}

export function generateKit(input: unknown, library: SoundEffect[], opts: KitOptions = {}): KitResult {
  const v = validateKit(input, library, opts);
  if (!v.ok) return v;
  const { ir, game: g } = v;
  const sentences = new Map(g.rules.map((r) => [r.id, ruleSentence(r, g)]));
  const emitted = emitKit(ir, { sentence: (r) => sentences.get(r.id) ?? "" });
  const files: Record<string, Uint8Array> = {};
  for (const gfx of emitted.graphics) files[`${gfx.name}.png`] = encodeIndexedPng(gfx.rows);
  files["font.png"] = encodeIndexedPng(fontRows(FONT_CHARS));
  const soundBlocks = ir.sounds.map((s) => soundData(s.label, library.find((x) => x.id === s.id)!)).join("\n\n");

  const marked = Handlebars.create()
    .compile(kitEngine, { noEscape: true, strict: true, ignoreStandalone: true })({
      ...emitted.view,
      title: sanitizeTitle(g.title),
      runtimeVersion: KIT_RUNTIME_VERSION,
      alphachars: FONT_CHARS,
      soundData: soundBlocks,
    })
    .replace(/\n{3,}/g, "\n\n");
  const { source, spans } = takeSpans(marked);

  const lint = lintBasic(source);
  if (lint.length) return { ok: false, errors: lint.map((l) => `Runtime error on line ${l.line}: ${l.message}`) };
  return { ok: true, input: { source, files }, ir, spans };
}

export { ROOMTOP };
