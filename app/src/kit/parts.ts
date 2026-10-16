// Movement presets: v1's 13 behaviours, re-expressed as bundles of the
// general movement parts. The migration uses them, and the editor offers them as the
// simple way to say how a thing moves; presetOf reads a type's parts back
// as a preset when they match one.

import { SPEED_STEPS, type KitMove, type KitRule, type KitType } from "./schema.ts";

/** The movement presets, in the order the editor lists them. */
export const BEHAVIOURS = [
  "still",
  "player-lr",
  "player-4way",
  "player-8way",
  "patrol-h",
  "patrol-v",
  "bounce",
  "chase",
  "march",
  "fall",
  "projectile-up",
  "projectile-down",
  "flee",
] as const;
export type Behaviour = (typeof BEHAVIOURS)[number];
export const PLAYER_BEHAVIOURS: Behaviour[] = ["player-lr", "player-4way", "player-8way"];

export type Parts = Pick<KitType, "control" | "steer" | "gravity" | "move">;

/** A player is anything a joystick controls. */
export const isControlled = (t: Pick<KitType, "control">) => !!t.control;

/** v1 speeds 1-4 are speed steps 1-4 (a quarter, half, one and two pixels per frame). */
const v = (speed: number) => SPEED_STEPS[speed]!;

/**
 * The parts for a movement preset at a speed (1-6). `player` is the kind
 * chasers chase and fleers flee; `pace` makes things nobody controls faster
 * by a counter (v1's levels).
 */
export function presetParts(b: Behaviour, speed: number, player: string | null, pace?: { plus: string; max: number }): Parts {
  const s = v(speed);
  const moving = (vx: number, vy: number, wall: KitMove["wall"], edge: KitMove["edge"], extra: Partial<KitMove> = {}): KitMove => ({
    vx,
    vy,
    wall,
    edge,
    ...(pace && (vx || vy) ? { pace } : {}),
    ...extra,
  });
  const speedOf = pace ? { step: speed, plus: pace.plus, max: pace.max } : { step: speed };
  switch (b) {
    case "still":
      return { move: { vx: 0, vy: 0, wall: "stop", edge: "stop" } };
    case "player-lr":
    case "player-4way":
    case "player-8way":
      return {
        control: { joystick: 1, axes: b === "player-lr" ? "lr" : b === "player-4way" ? "4way" : "8way", mode: "direct", speed: { step: speed } },
        move: { vx: 0, vy: 0, wall: "slide", edge: "stop" },
      };
    case "patrol-h":
      return { move: moving(s, 0, "bounce", "bounce") };
    case "patrol-v":
      return { move: moving(0, s, "bounce", "bounce") };
    case "bounce":
      return { move: moving(s, s, "bounce", "bounce") };
    case "chase":
    case "flee":
      if (!player) return { move: { vx: 0, vy: 0, wall: "stop", edge: "stop" } };
      return { steer: { toward: player, ...(b === "flee" ? { away: true } : {}), speed: speedOf, every: 1 }, move: { vx: 0, vy: 0, wall: "slide", edge: "stop" } };
    case "march":
      // Walls don't stop a formation (as in v1); a rule turns it at the sides.
      return { move: moving(s, 0, "through", "pass", { smooth: true }) };
    case "fall":
      return { move: moving(0, s, "through", "pass") };
    case "projectile-up":
      // v1 moved shots 2 × speed + 2 pixels a frame: 4 at speed 3. No pace: not a speed step.
      return { move: { vx: 0, vy: -Math.min(112, 2 * s + 32), wall: "destroy", edge: "destroy", smooth: true } };
    case "projectile-down":
      return { move: { vx: 0, vy: Math.min(112, s + 16), wall: "destroy", edge: "destroy", smooth: true } };
  }
}

/** The rule a preset needs besides its parts (the march's turn, the fall's return to the top), if any. */
export function presetRule(b: Behaviour, t: Pick<KitType, "id" | "width">, id: string): KitRule | null {
  if (b === "march") {
    return {
      id,
      when: { edge: [t.id, "sides"] },
      any: true,
      fires: "once",
      then: [
        { id: `${id}-1`, set: { what: { prop: "vx", of: { every: t.id } }, to: { prop: "vx", of: "target", neg: true } } },
        { id: `${id}-2`, add: { what: { prop: "y", of: { every: t.id } }, by: 8 } },
      ],
    };
  }
  if (b === "fall") {
    return {
      id,
      when: { leaves: t.id },
      then: [
        { id: `${id}-1`, set: { what: { prop: "x", of: "it" }, to: { random: Math.floor((160 - t.width) / 8), times: 8 } } },
        { id: `${id}-2`, set: { what: { prop: "y", of: "it" }, to: 16 } },
      ],
    };
  }
  return null;
}

const same = (a: unknown, b: unknown) => JSON.stringify(normal(a)) === JSON.stringify(normal(b));
/** Drops defaults and the pace, so a type's parts compare with a preset's. */
function normal(p: unknown): unknown {
  if (!p || typeof p !== "object") return p;
  const o = { ...(p as Record<string, unknown>) };
  delete o.pace;
  if (o.every === 1) delete o.every;
  if (o.mode === "direct") delete o.mode;
  if (o.smooth === false) delete o.smooth;
  if (o.speed && typeof o.speed === "object") o.speed = { step: (o.speed as { step: number }).step };
  return Object.fromEntries(Object.entries(o).filter(([, x]) => x !== undefined).sort(([a], [b]) => a.localeCompare(b)));
}

/** The preset and speed a type's parts match, or null when they're custom. */
export function presetOf(t: KitType): { behaviour: Behaviour; speed: number } | null {
  const player = t.steer?.toward ?? null;
  for (const b of BEHAVIOURS) {
    for (let speed = 1; speed <= 6; speed++) {
      const p = presetParts(b, speed, player);
      if (same(p.control, t.control) && same(p.steer, t.steer) && same(p.gravity, t.gravity) && same(p.move, t.move)) return { behaviour: b, speed };
    }
  }
  return null;
}
