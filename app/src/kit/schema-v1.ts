// Kit game format version 1, frozen (kit runtime 0.2/0.3). Only migrations.ts
// and tests that build old-style games read it; never change it: it stands for
// the games people saved before format 2.

import { z } from "zod";
import { ColorSchema, PaletteSchema } from "../project/schema.ts";

/** Order matters: it is the runtime's `on b gosub` table. */
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

export const ROOM_COLS = 20;
export const ROOM_ROWS = 11;
export const MAX_OBJECTS = 24;
export const MAX_TYPES = 8;
/** Named numbers a game can keep (keys, coins, combo…), besides the built-in level. */
export const MAX_COUNTERS = 4;
/** Characters the kit font can draw (also used by alphachars). `#`, `~` and `*` are the wall, hazard and goal tiles. */
export const FONT_CHARS = "0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ.!?-:#~*";
/** Room tiles besides empty. Walls block movement; hazards and goals are only noticed by rules. */
export const TILES = ["wall", "hazard", "goal"] as const;
export type Tile = (typeof TILES)[number];
/** The built-in counter: 1 at the start, plus one for each "next level". */
export const LEVEL = "level";

const Id = z.string().regex(/^[a-z][a-z0-9-]{0,23}$/, "Ids are short lowercase names");

/**
 * Movement built from parts (format 1, late): a type
 * with `move` ignores its behaviour's movement and moves by its own velocity
 * properties instead, reacting to walls and screen edges.
 */
export const REACTIONS = ["stop", "bounce", "wrap", "turn", "destroy"] as const;
export type Reaction = (typeof REACTIONS)[number];
/** Velocity is in quarter pixels per frame, so 4 is one pixel. */
const Velocity = z.number().int().min(-16).max(16);
export const MoveV1Schema = z
  .object({
    /** Starting velocity of each thing of this type. */
    vx: Velocity,
    vy: Velocity,
    /** What happens when a wall or the screen edge is in the way. */
    react: z.enum(REACTIONS),
  })
  .strict();
export type KitMoveV1 = z.infer<typeof MoveV1Schema>;

export const KitTypeV1Schema = z.object({
  id: Id,
  label: z.string().min(1).max(30),
  width: z.number().int().min(4).max(16).multipleOf(4),
  height: z.number().int().min(1).max(16),
  /** 1 or 2 frames (2 animate); rows of `0`-`3` like project sprites. */
  frames: z.array(z.array(z.string())).min(1).max(2),
  palette: Id,
  behaviour: z.enum(BEHAVIOURS),
  /** 1 = a quarter pixel per frame, 2 = half, 3 = one, 4 = two. */
  speed: z.number().int().min(1).max(4),
  /** Player types: what fire launches. */
  shoots: Id.optional(),
  /** Any type: drops another type below it at random, one at a time. */
  drops: z.object({ type: Id, chance: z.number().int().min(1).max(40) }).optional(),
  /** Spike: velocity movement instead of the behaviour's (not for players). */
  move: MoveV1Schema.optional(),
});
export type KitTypeV1 = z.infer<typeof KitTypeV1Schema>;

const Who = z.enum(["first", "second"]);
const Count = z.number().int().min(0).max(99);
export const CounterV1Schema = z.object({
  id: Id,
  label: z.string().min(1).max(20),
  start: Count.default(0),
  /** Show it in the HUD (one counter at most). */
  show: z.boolean().optional(),
});
export type KitCounterV1 = z.infer<typeof CounterV1Schema>;

export const KitTriggerV1Schema = z.union([
  z.object({ touch: z.tuple([Id, Id]) }).strict(),
  z.object({ allGone: Id }).strict(),
  z.object({ reachesBottom: Id }).strict(),
  z.object({ timer: z.number().int().min(1).max(99) }).strict(),
  /** Every N seconds while playing. */
  z.object({ every: z.number().int().min(1).max(60) }).strict(),
  /** A counter (or the level) reaches at least N; fires once each time it gets there. */
  z.object({ reaches: z.tuple([Id, Count]) }).strict(),
  /** A thing of this type is on a hazard or goal tile (checked at its middle). */
  z.object({ onTile: z.tuple([Id, z.enum(["hazard", "goal"])]) }).strict(),
]);
export type KitTriggerV1 = z.infer<typeof KitTriggerV1Schema>;

export const KitActionV1Schema = z.union([
  z.object({ remove: Who }).strict(),
  z.object({ respawn: Who }).strict(),
  z.object({ score: z.number().int().min(10).max(990).multipleOf(10) }).strict(),
  z.object({ loseLife: z.literal(true) }).strict(),
  z.object({ win: z.literal(true) }).strict(),
  z.object({ lose: z.literal(true) }).strict(),
  z.object({ restartRoom: z.literal(true) }).strict(),
  z.object({ sound: z.string() }).strict(),
  /** Counters: add, take away (stops at 0) or set. Add stops at 99. */
  z.object({ add: z.tuple([Id, z.number().int().min(1).max(99)]) }).strict(),
  z.object({ take: z.tuple([Id, z.number().int().min(1).max(99)]) }).strict(),
  z.object({ set: z.tuple([Id, Count]) }).strict(),
  /** The rule's first or second thing becomes another type, optionally for some seconds. */
  z.object({ turn: z.object({ who: Who, into: Id, seconds: z.number().int().min(1).max(60).optional() }).strict() }).strict(),
  /** Every thing of a type becomes another type, optionally for some seconds. */
  z.object({ turnAll: z.object({ type: Id, into: Id, seconds: z.number().int().min(1).max(60).optional() }).strict() }).strict(),
  /** Start the room again with the level one higher: things move faster every second level. */
  z.object({ nextLevel: z.literal(true) }).strict(),
]);
export type KitActionV1 = z.infer<typeof KitActionV1Schema>;

export const ConditionV1Schema = z.object({ counter: Id, op: z.enum(["eq", "ne", "gte", "lte"]), value: Count }).strict();
export type KitConditionV1 = z.infer<typeof ConditionV1Schema>;

export const KitRuleV1Schema = z.object({
  when: KitTriggerV1Schema,
  /** "Only if" clauses, all of which must hold. */
  if: z.array(ConditionV1Schema).max(2).optional(),
  then: z.array(KitActionV1Schema).min(1).max(6),
});
export type KitRuleV1 = z.infer<typeof KitRuleV1Schema>;

/** The game file's format version; kit/migrations.ts brings older files up to it. */
export const KIT_V1 = 1;

export const KitGameV1Schema = z.object({
  kit: z.literal(KIT_V1),
  title: z.string().max(60),
  palettes: z.array(PaletteSchema).min(1).max(8),
  background: ColorSchema,
  wallPalette: Id,
  textPalette: Id,
  lives: z.number().int().min(1).max(9),
  types: z.array(KitTypeV1Schema).min(1).max(MAX_TYPES),
  room: z.object({
    /** ROOM_ROWS strings of ROOM_COLS characters; space or `.` is empty. */
    rows: z.array(z.string()),
    /** What each character places: a tile, or an object of a type (at that cell's top-left). */
    legend: z.record(z.string().length(1), z.union([z.enum(TILES), Id])),
  }),
  counters: z.array(CounterV1Schema).max(MAX_COUNTERS).default([]),
  rules: z.array(KitRuleV1Schema).max(16),
  text: z.object({ title: z.string(), win: z.string(), lose: z.string() }),
  sounds: z.object({ shoot: z.string().optional() }).default({}),
  /** The print kit's manual: the creator's own text, or null to follow the draft. */
  cartridge: z.object({ manualText: z.string().nullable() }).default({ manualText: null }),
});
export type KitGameV1 = z.infer<typeof KitGameV1Schema>;
