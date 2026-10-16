// Game kit (spike): one generic runtime (templates/kit/engine.bas.hbs) driven
// by data. A kit game is object types with behaviours, a painted room, rules
// and text. Genres are just different data.

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
] as const;
export type Behaviour = (typeof BEHAVIOURS)[number];
export const PLAYER_BEHAVIOURS: Behaviour[] = ["player-lr", "player-4way", "player-8way"];

export const ROOM_COLS = 20;
export const ROOM_ROWS = 11;
export const MAX_OBJECTS = 24;
export const MAX_TYPES = 8;
/** Characters the kit font can draw (also used by alphachars). `#` is the wall tile. */
export const FONT_CHARS = "0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ.!?-:#";

const Id = z.string().regex(/^[a-z][a-z0-9-]{0,23}$/, "Ids are short lowercase names");

export const KitTypeSchema = z.object({
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
});
export type KitType = z.infer<typeof KitTypeSchema>;

const Who = z.enum(["first", "second"]);
export const KitTriggerSchema = z.union([
  z.object({ touch: z.tuple([Id, Id]) }).strict(),
  z.object({ allGone: Id }).strict(),
  z.object({ reachesBottom: Id }).strict(),
  z.object({ timer: z.number().int().min(1).max(99) }).strict(),
]);
export type KitTrigger = z.infer<typeof KitTriggerSchema>;

export const KitActionSchema = z.union([
  z.object({ remove: Who }).strict(),
  z.object({ respawn: Who }).strict(),
  z.object({ score: z.number().int().min(10).max(990).multipleOf(10) }).strict(),
  z.object({ loseLife: z.literal(true) }).strict(),
  z.object({ win: z.literal(true) }).strict(),
  z.object({ lose: z.literal(true) }).strict(),
  z.object({ restartRoom: z.literal(true) }).strict(),
  z.object({ sound: z.string() }).strict(),
]);
export type KitAction = z.infer<typeof KitActionSchema>;

export const KitRuleSchema = z.object({ when: KitTriggerSchema, then: z.array(KitActionSchema).min(1).max(6) });
export type KitRule = z.infer<typeof KitRuleSchema>;

export const KitGameSchema = z.object({
  kit: z.literal(1),
  title: z.string().max(60),
  palettes: z.array(PaletteSchema).min(1).max(8),
  background: ColorSchema,
  wallPalette: Id,
  textPalette: Id,
  lives: z.number().int().min(1).max(9),
  types: z.array(KitTypeSchema).min(1).max(MAX_TYPES),
  room: z.object({
    /** ROOM_ROWS strings of ROOM_COLS characters; space or `.` is empty. */
    rows: z.array(z.string()),
    /** What each character places: a wall, or an object of a type (at that cell's top-left). */
    legend: z.record(z.string().length(1), z.union([z.literal("wall"), Id])),
  }),
  rules: z.array(KitRuleSchema).max(16),
  text: z.object({ title: z.string(), win: z.string(), lose: z.string() }),
  sounds: z.object({ shoot: z.string().optional() }).default({}),
});
export type KitGame = z.infer<typeof KitGameSchema>;
