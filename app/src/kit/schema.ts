// Game kit: one runtime (engine.bas.hbs) driven by data. A kit game is kinds of thing
// built from movement parts, rooms, counters and rules made of general
// events, targets and values. The generator compiles it to 7800basic
// through a typed IR (ir.ts); nothing in the runtime knows about genres.
//
// Units: positions are pixels (x 0-159, y 16-191 below the HUD). Velocities
// are sixteenths of a pixel per frame (16 = one pixel), held as 8.8 fixed
// point at run time. Timers and protection count tenths of a second.

import { z } from "zod";
import { ColorSchema, PaletteSchema } from "../project/schema.ts";

export const ROOM_COLS = 20;
export const ROOM_ROWS = 11;
export const MAX_OBJECTS = 24;
export const MAX_TYPES = 8;
export const MAX_RULES = 24;
export const MAX_ROOMS = 8;
/** Named numbers (lives, keys, combo…). Score and seconds are built in besides these. */
export const MAX_COUNTERS = 8;
export const MAX_MESSAGES = 8;
/** Numbers along the top of the screen. */
export const MAX_HUD = 4;
/** "Made by" fits the title screen's credit line: "BY " plus this many characters is one 32-character line. */
export const MADE_BY_MAX = 29;
/** Characters the kit font can draw (also used by alphachars). `#`, `~` and `*` are the wall, hazard and goal tiles. */
export const FONT_CHARS = "0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ.!?-:#~*";
/** Room tiles besides empty. Walls block movement; hazards and goals are only noticed by rules. */
export const TILES = ["wall", "hazard", "goal"] as const;
export type Tile = (typeof TILES)[number];
/** Built-in values a rule can read: the 6-digit score (add and take only) and the seconds since the room started. */
export const SCORE = "score";
export const SECONDS = "seconds";
/** Counter names the runtime gives fixed variables (lives, levelnum), so behaviour tests can watch them. */
export const LIVES = "lives";
export const LEVEL = "level";

/**
 * Speed steps, in sixteenths of a pixel per frame: step 1 is a quarter
 * pixel, 2 half, 3 one, 4 two, 5 three, 6 four.
 */
export const SPEED_STEPS = [0, 4, 8, 16, 32, 48, 64] as const;

const Id = z.string().regex(/^[a-z][a-z0-9-]{0,23}$/, "Ids are short lowercase names");
/** Stable ids for rules and actions (`r-3fa9`), given when they're made and never reused. */
export const StableId = z.string().regex(/^[a-z]-[a-z0-9-]{1,16}$/, "Ids look like r-3fa9");
const Text = (max: number) => z.string().max(max);

/** "N, plus a counter" (capped), so things can speed up with a level without engine code. */
export const SpeedSchema = z
  .object({
    step: z.number().int().min(1).max(6),
    plus: Id.optional(),
    /** The fastest step `plus` can take it to. */
    max: z.number().int().min(1).max(6).optional(),
  })
  .strict();
export type KitSpeed = z.infer<typeof SpeedSchema>;

export const AXES = ["lr", "ud", "4way", "8way"] as const;
export const ControlSchema = z
  .object({
    /** Joystick 2 is reserved for two players (the "Player 2" part); the generator says it's coming. */
    joystick: z.union([z.literal(1), z.literal(2)]),
    axes: z.enum(AXES),
    /** direct: moves while pushed; keep: the last direction pushed keeps it going. */
    mode: z.enum(["direct", "keep"]).default("direct"),
    speed: SpeedSchema,
  })
  .strict();
export type KitControl = z.infer<typeof ControlSchema>;

export const SteerSchema = z
  .object({
    /** The kind of thing to steer toward (or away from): the nearest one. */
    toward: Id,
    away: z.boolean().optional(),
    speed: SpeedSchema,
    /** How often it changes course: every frame, every 2nd or every 4th. */
    every: z.union([z.literal(1), z.literal(2), z.literal(4)]).default(1),
  })
  .strict();
export type KitSteer = z.infer<typeof SteerSchema>;

export const GravitySchema = z
  .object({
    /** Sixteenths of a pixel per frame added to the velocity every frame (negative points up), or one of its per-thing variables. */
    amount: z.union([z.number().int().min(-32).max(32), z.object({ prop: z.enum(["a", "b"]) }).strict()]),
    /** Top speed along the gravity, in sixteenths of a pixel per frame. */
    max: z.number().int().min(1).max(112),
    axis: z.enum(["y", "x"]).default("y"),
  })
  .strict();
export type KitGravity = z.infer<typeof GravitySchema>;

export const WALL_REACTIONS = ["stop", "slide", "bounce", "turn", "destroy", "through"] as const;
export const EDGE_REACTIONS = ["stop", "bounce", "wrap", "turn", "destroy", "pass"] as const;
export type WallReaction = (typeof WALL_REACTIONS)[number];
export type EdgeReaction = (typeof EDGE_REACTIONS)[number];
const Velocity = z.number().int().min(-112).max(112);
export const MoveSchema = z
  .object({
    /** Starting velocity, in sixteenths of a pixel per frame. */
    vx: Velocity.default(0),
    vy: Velocity.default(0),
    /** Each point of this counter makes the starting speed one step faster (the speed must be a step: 4, 8, 16, 32, 48 or 64). */
    pace: z.object({ plus: Id, max: z.number().int().min(1).max(6) }).strict().optional(),
    /** What happens when a wall is in the way. "through" doesn't check walls at all. */
    wall: z.enum(WALL_REACTIONS).default("stop"),
    /** What happens at a screen edge. "pass" goes on, and then it has left the screen. */
    edge: z.enum(EDGE_REACTIONS).default("stop"),
    /** Update every frame. Otherwise things nobody controls move on alternate frames, twice as far (cheaper). */
    smooth: z.boolean().optional(),
  })
  .strict();
export type KitMove = z.infer<typeof MoveSchema>;

export const DisplaySchema = z
  .object({
    /** With 2 animation frames: change every 4, 8, 16 or 32 frames, or only while moving. */
    animate: z.union([z.literal(4), z.literal(8), z.literal(16), z.literal(32), z.literal("moving")]).optional(),
    /** Frames chosen by facing: none, left/right (2 sets), or 4 directions (right, down, left, up). */
    directions: z.enum(["none", "lr", "4"]).optional(),
  })
  .strict();
export type KitDisplay = z.infer<typeof DisplaySchema>;

const VarSchema = z.object({ name: Text(12), start: z.number().int().min(0).max(255) }).strict();

export const KitTypeSchema = z
  .object({
    id: Id,
    label: z.string().min(1).max(30),
    width: z.number().int().min(4).max(16).multipleOf(4),
    height: z.number().int().min(1).max(16),
    /** Rows of `0`-`3` like project sprites: animation frames, times direction sets (see display). */
    frames: z.array(z.array(z.string().max(16)).max(16)).min(1).max(8),
    palette: Id,
    control: ControlSchema.optional(),
    steer: SteerSchema.optional(),
    gravity: GravitySchema.optional(),
    move: MoveSchema.default({ vx: 0, vy: 0, wall: "stop", edge: "stop" }),
    display: DisplaySchema.optional(),
    /** The two per-thing variables, named per kind ("hp", "phase"). */
    vars: z.object({ a: VarSchema.optional(), b: VarSchema.optional() }).strict().optional(),
    /** Most of this kind at once, for things rules create (default: as many as any room places, plus 1). */
    cap: z.number().int().min(1).max(MAX_OBJECTS).optional(),
  })
  .strict();
export type KitType = z.infer<typeof KitTypeSchema>;

export const CounterSchema = z
  .object({
    id: Id,
    label: z.string().min(1).max(20),
    start: z.number().int().min(0).max(99).default(0),
    /** "room": back to its start whenever a room starts. */
    keep: z.enum(["game", "room"]).optional(),
  })
  .strict();
export type KitCounter = z.infer<typeof CounterSchema>;

// ---- values ----

export const PROPS = ["x", "y", "vx", "vy", "facing", "a", "b", "timer"] as const;
export type Prop = (typeof PROPS)[number];
export const SIDES = ["left", "right", "top", "bottom"] as const;
export type Side = (typeof SIDES)[number];
/** Whose property: the rule's thing, the other thing it touched, or the action's target. */
export const WhoseSchema = z.enum(["it", "other", "target"]);
export type Whose = z.infer<typeof WhoseSchema>;

const Mods = {
  /** Applied in this order: times or divided by, negated, plus. */
  times: z.number().int().min(1).max(16).optional(),
  div: z.union([z.literal(2), z.literal(4), z.literal(8)]).optional(),
  neg: z.literal(true).optional(),
  plus: z.number().int().min(-128).max(255).optional(),
};
export const ValueSchema = z.union([
  /** Numbers are bytes (-128 to 255), except points added to or taken from the score (up to 9990). */
  z.number().int().min(-128).max(9990),
  z.object({ counter: Id, ...Mods }).strict(),
  z.object({ prop: z.enum(PROPS), of: WhoseSchema, ...Mods }).strict(),
  z.object({ count: Id, ...Mods }).strict(),
  /** 0 to N. */
  z.object({ random: z.number().int().min(1).max(255), ...Mods }).strict(),
  /** Joystick direction as -1, 0 or 1. */
  z.object({ joy: z.union([z.literal(1), z.literal(2)]), axis: z.enum(["x", "y"]), ...Mods }).strict(),
  /** A thing's facing as -1, 0 or 1 along an axis. */
  z.object({ facing: z.enum(["x", "y"]), of: WhoseSchema, ...Mods }).strict(),
  /** 1 when movement left it against a wall (or a screen edge) on that side, else 0. */
  z.object({ contact: z.enum(SIDES), of: WhoseSchema, ...Mods }).strict(),
]);
export type KitValue = z.infer<typeof ValueSchema>;

export const OPS = ["eq", "ne", "gt", "gte", "lt", "lte"] as const;
export type Op = (typeof OPS)[number];
export const CompareSchema = z.object({ a: ValueSchema, op: z.enum(OPS), b: ValueSchema }).strict();
export type KitCompare = z.infer<typeof CompareSchema>;

// ---- events ----

export const EDGE_SIDES = ["left", "right", "top", "bottom", "sides", "any"] as const;
export const KitTriggerSchema = z.union([
  /** State: a thing of the first kind overlaps one of the second. It: the first; the other: the second. */
  z.object({ touch: z.tuple([Id, Id]) }).strict(),
  /** State: a thing is on a hazard or goal tile (checked at its middle). */
  z.object({ onTile: z.tuple([Id, z.enum(["hazard", "goal"])]) }).strict(),
  /** State: a thing touches (or is past) a screen edge. */
  z.object({ edge: z.tuple([Id, z.enum(EDGE_SIDES)]) }).strict(),
  /** State: movement left a thing against a wall on that side. */
  z.object({ wall: z.tuple([Id, z.enum([...SIDES, "any"])]) }).strict(),
  /** Event: a thing (whose edge reaction is "pass") is now wholly off the screen. */
  z.object({ leaves: Id }).strict(),
  /** Event: a thing's timer ran out. */
  z.object({ timerOut: Id }).strict(),
  /** Event: a thing appeared (it is the new thing). */
  z.object({ created: Id }).strict(),
  /** Event: a thing is about to go (it can still be read). */
  z.object({ destroyed: Id }).strict(),
  /** Event: a button pressed (or released). It: each thing that joystick controls. */
  z.object({ button: z.object({ joy: z.union([z.literal(1), z.literal(2)]), button: z.union([z.literal(1), z.literal(2)]), released: z.boolean().optional() }).strict() }).strict(),
  /** Event: the joystick is pushed a way (the moment it's pushed). */
  z.object({ pushed: z.object({ joy: z.union([z.literal(1), z.literal(2)]), dir: z.enum(["left", "right", "up", "down", "any"]) }).strict() }).strict(),
  /** Every N seconds (or frames) while playing. */
  z.object({ every: z.number().int().min(1).max(60), frames: z.boolean().optional() }).strict(),
  /** Once, N seconds after the room starts. */
  z.object({ after: z.number().int().min(1).max(99) }).strict(),
  z.object({ roomStart: z.literal(true) }).strict(),
  /** State: a comparison holds (a counter reaches 3, the count of yarn is 0…). */
  z.object({ test: CompareSchema }).strict(),
  /** A message sent by another rule. */
  z.object({ message: Id }).strict(),
]);
export type KitTrigger = z.infer<typeof KitTriggerSchema>;

// ---- targets and actions ----

export const TargetSchema = z.union([
  z.enum(["it", "other"]),
  /** Every thing of a kind, optionally only those for which a comparison holds (its values read "target"). */
  z.object({ every: Id, where: CompareSchema.optional() }).strict(),
  z.object({ nearest: Id }).strict(),
  z.object({ random: Id }).strict(),
]);
export type KitTarget = z.infer<typeof TargetSchema>;

export const SettableSchema = z.union([z.object({ counter: Id }).strict(), z.object({ prop: z.enum(PROPS), of: TargetSchema }).strict()]);
export type KitSettable = z.infer<typeof SettableSchema>;

const A = { id: StableId };
export const KitActionSchema = z.union([
  z.object({ ...A, set: z.object({ what: SettableSchema, to: ValueSchema }).strict() }).strict(),
  /** Counters stop at 99 (score at 999999); properties wrap, except x and y, which stay on screen. */
  z.object({ ...A, add: z.object({ what: SettableSchema, by: ValueSchema }).strict() }).strict(),
  /** Counters stop at 0. */
  z.object({ ...A, take: z.object({ what: SettableSchema, by: ValueSchema }).strict() }).strict(),
  /** Walks a thing by (dx, dy) pixels; walls and edges stop it. */
  z.object({ ...A, step: z.object({ who: TargetSchema, dx: ValueSchema, dy: ValueSchema }).strict() }).strict(),
  /**
   * A new thing at a target ("above" it, "below", "centre" or "on" its top-left) or at (x, y),
   * plus an offset and optionally a starting velocity. Does nothing when the kind is at its cap.
   */
  z
    .object({
      ...A,
      create: z
        .object({
          type: Id,
          at: z.union([TargetSchema, z.object({ x: ValueSchema, y: ValueSchema }).strict()]),
          place: z.enum(["on", "above", "below", "centre"]).optional(),
          dx: z.number().int().min(-128).max(127).optional(),
          dy: z.number().int().min(-128).max(127).optional(),
          vx: ValueSchema.optional(),
          vy: ValueSchema.optional(),
        })
        .strict(),
    })
    .strict(),
  z.object({ ...A, destroy: TargetSchema }).strict(),
  z.object({ ...A, turn: z.object({ who: TargetSchema, into: Id, seconds: z.number().int().min(1).max(25).optional() }).strict() }).strict(),
  z.object({ ...A, toStart: TargetSchema }).strict(),
  z.object({ ...A, startHere: TargetSchema }).strict(),
  /** Protected things blink, and touch and tile rules skip them. */
  z.object({ ...A, protect: z.object({ who: TargetSchema, tenths: z.number().int().min(1).max(255) }).strict() }).strict(),
  z.object({ ...A, sound: z.string().max(40) }).strict(),
  z.object({ ...A, send: Id }).strict(),
  z.object({ ...A, restartRoom: z.literal(true) }).strict(),
  /** Rooms count from 1 (the first room). */
  z.object({ ...A, goRoom: z.number().int().min(1).max(MAX_ROOMS) }).strict(),
  z.object({ ...A, nextRoom: z.literal(true) }).strict(),
  /** Placed things that were taken come back (with flow.remember). */
  z.object({ ...A, resetTaken: z.literal(true) }).strict(),
  z.object({ ...A, gameOver: z.enum(["won", "lost"]) }).strict(),
  /** Coder mode: gosub one of the game's own routines (code.routines), with "it" in oi. */
  z.object({ ...A, run: Id }).strict(),
]);
export type KitAction = z.infer<typeof KitActionSchema>;

export const KitRuleSchema = z
  .object({
    id: StableId,
    when: KitTriggerSchema,
    /**
     * For states (touch, on a tile, at an edge or wall, a test): "once" fires each time it becomes
     * true, "while" every frame it holds. Each kind of state has a default (stateDefault in ir.ts).
     */
    fires: z.enum(["once", "while"]).optional(),
    /** For states about things: fire once a frame if any thing matches (it: the first), instead of once per thing. */
    any: z.boolean().optional(),
    /** "Only if" clauses, all of which must hold. */
    if: z.array(CompareSchema).max(3).optional(),
    then: z.array(KitActionSchema).min(1).max(12),
  })
  .strict();
export type KitRule = z.infer<typeof KitRuleSchema>;

// ---- rooms, flow, code ----

const RoomNumber = z.number().int().min(1).max(MAX_ROOMS);
export const ExitsSchema = z
  .object({ left: RoomNumber.optional(), right: RoomNumber.optional(), up: RoomNumber.optional(), down: RoomNumber.optional() })
  .strict();
export type KitExits = z.infer<typeof ExitsSchema>;
const Rows = z.array(z.string().max(ROOM_COLS)).max(ROOM_ROWS);
export const RoomSchema = z
  .object({
    /** ROOM_ROWS strings of ROOM_COLS characters; space or `.` is empty. */
    rows: Rows,
    /** What each character places: a tile, or a thing of a kind (at that cell's top-left). Shared by every room. */
    legend: z.record(z.string().length(1), z.union([z.enum(TILES), Id])),
    exits: ExitsSchema.optional(),
  })
  .strict();
export const ExtraRoomSchema = z.object({ rows: Rows, exits: ExitsSchema.optional() }).strict();

export const HUD_SLOTS = ["left", "middle", "middle-right", "right"] as const;
export const HudSchema = z.object({ show: Id, at: z.enum(HUD_SLOTS) }).strict();
export type KitHud = z.infer<typeof HudSchema>;

export const FlowSchema = z
  .object({
    /** A title screen first (press fire to play); false powers on straight into play. */
    title: z.boolean().default(true),
    /** After this many seconds on the title, a demo plays the first room with recorded input. */
    attract: z
      .object({
        after: z.number().int().min(3).max(60),
        /** Recorded joystick: pairs of (input bits, frames). Bits: 1 up, 2 down, 4 left, 8 right, 16 fire. */
        input: z.array(z.number().int().min(0).max(255)).max(64).optional(),
      })
      .strict()
      .nullable()
      .default(null),
    /** The won and lost screens: counters to show, and seconds before going back to the title (0: wait for fire). */
    end: z.object({ show: z.array(Id).max(2).default([]), after: z.number().int().min(0).max(30).default(0) }).strict().default({ show: [], after: 0 }),
    /** Rooms remember which placed things were taken (destroyed), and don't place them again. */
    remember: z.boolean().default(false),
  })
  .strict();
export type KitFlow = z.infer<typeof FlowSchema>;

const Body = z.string().max(4000);
export const CodeSchema = z
  .object({
    init: Body.optional(),
    startroom: Body.optional(),
    frame: Body.optional(),
    draw: Body.optional(),
    /** Per kind of thing, after its movement (the thing's slot is in mi). */
    update: z.record(Id, Body).optional(),
    /** Routines a "run code" action can call (with "it" in oi); each ends with return. */
    routines: z.array(z.object({ label: Id, body: Body }).strict()).max(16).optional(),
    /** Frame cost (points out of 100) each non-empty hook declares; the cost model can't see inside. */
    cost: z.number().int().min(0).max(100).default(10),
  })
  .strict();
export type KitCode = z.infer<typeof CodeSchema>;

/** The game file's format version; kit/migrations.ts brings older files up to it. */
export const KIT_VERSION = 2;

export const KitGameSchema = z
  .object({
    kit: z.literal(KIT_VERSION),
    title: z.string().max(60),
    /** Who made it, as typed ("Sam and Robin"). Shown on the title screen, box, label, manual and player when set; never filled in from an account. */
    madeBy: z.string().max(MADE_BY_MAX).optional(),
    palettes: z.array(PaletteSchema).min(1).max(8),
    background: ColorSchema,
    wallPalette: Id,
    textPalette: Id,
    types: z.array(KitTypeSchema).min(1).max(MAX_TYPES),
    /** The first room (room 1). */
    room: RoomSchema,
    /** Rooms 2, 3…, which share the first room's legend. */
    rooms: z.array(ExtraRoomSchema).max(MAX_ROOMS - 1).default([]),
    counters: z.array(CounterSchema).max(MAX_COUNTERS).default([]),
    /** Up to four values on screen: score, seconds or a counter. */
    hud: z.array(HudSchema).max(MAX_HUD).default([]),
    messages: z.array(Id).max(MAX_MESSAGES).default([]),
    rules: z.array(KitRuleSchema).max(MAX_RULES),
    text: z.object({ title: Text(60), win: Text(60), lose: Text(60) }).strict(),
    flow: FlowSchema.default({ title: true, attract: null, end: { show: [], after: 0 }, remember: false }),
    code: CodeSchema.optional(),
    /** The print kit's manual: the creator's own text, or null to follow the draft. */
    cartridge: z.object({ manualText: z.string().max(20000).nullable() }).default({ manualText: null }),
    /** The "easier" assist for younger players, worked by the left difficulty switch (kit/assist.ts). */
    assist: z.object({ easier: z.boolean() }).strict().optional(),
  })
  .strict();
export type KitGame = z.infer<typeof KitGameSchema>;
/** A game as written in a file, before defaults are filled in. */
export type KitGameInput = z.input<typeof KitGameSchema>;
