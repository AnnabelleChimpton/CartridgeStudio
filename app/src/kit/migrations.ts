// Kit game migrations, keyed on the game's `kit` version. Each entry upgrades
// a game from version n to n + 1; loadKit runs them before validating, so
// saves, opened .cartridge files and presets all go through the same path.
// Frozen copies of each old version's presets live in kit/fixtures/v<n>/ and
// must keep migrating and building (migrations.test.ts).

import { readAssist, setEasier } from "./assist.ts";
import { BEHAVIOURS, PLAYER_BEHAVIOURS, presetParts, presetRule, type Behaviour } from "./parts.ts";
import { KIT_VERSION, KitGameSchema, LEVEL, LIVES, SCORE, type KitAction, type KitCompare, type KitCounter, type KitGame, type KitHud, type KitRule, type KitType } from "./schema.ts";
import { KitGameV1Schema, type KitActionV1, type KitConditionV1, type KitGameV1, type KitRuleV1, type KitTriggerV1, type KitTypeV1 } from "./schema-v1.ts";

type Migration = (game: Record<string, unknown>) => Record<string, unknown>;

/**
 * Rules the migration makes from v1 type properties and flow (shooting,
 * dropping, the march, falling, lives, levels) have ids starting `r-p-`.
 * A v1 behaviour test that swaps a game's rules keeps these (tests.ts).
 */
export const PART_RULE = "r-p-";

const PACE = "pace";
/** v1 games with levels: things nobody controls got a step faster at levels 3, 5 and 7 (when the room started). */
const PACE_LEVELS = [3, 5, 7];

interface V1Context {
  /** Kinds a joystick controls (v1's player). */
  players: string[];
}

const who = (w: "first" | "second") => (w === "first" ? "it" : "other");
const compare = (c: KitConditionV1): KitCompare => ({ a: { counter: c.counter }, op: c.op, b: c.value });

/** v1's "lose a life": take one, every player back to start, protected for 1.5 seconds. */
export function loseLifeActions(id: string, players: string[]): KitAction[] {
  return [
    { id: `${id}-l`, take: { what: { counter: LIVES }, by: 1 } },
    ...players.flatMap((p, k): KitAction[] => [
      { id: `${id}-s${k}`, toStart: { every: p } },
      { id: `${id}-p${k}`, protect: { who: { every: p }, tenths: 15 } },
    ]),
  ];
}

function actionFromV1(a: KitActionV1, id: string, ctx: V1Context): KitAction[] {
  if ("remove" in a) return [{ id, destroy: who(a.remove) }];
  if ("respawn" in a) return [{ id, toStart: who(a.respawn) }];
  if ("score" in a) return [{ id, add: { what: { counter: SCORE }, by: a.score } }];
  if ("loseLife" in a) return loseLifeActions(id, ctx.players);
  if ("win" in a) return [{ id, gameOver: "won" }];
  if ("lose" in a) return [{ id, gameOver: "lost" }];
  if ("restartRoom" in a) return [{ id, restartRoom: true }];
  if ("sound" in a) return [{ id, sound: a.sound }];
  if ("add" in a) return [{ id, add: { what: { counter: a.add[0] }, by: a.add[1] } }];
  if ("take" in a) return [{ id, take: { what: { counter: a.take[0] }, by: a.take[1] } }];
  if ("set" in a) return [{ id, set: { what: { counter: a.set[0] }, to: a.set[1] } }];
  // Per-thing timers count tenths in a byte, so a timed turn lasts at most 25 seconds.
  const secs = (s?: number) => (s ? { seconds: Math.min(25, s) } : {});
  if ("turn" in a) return [{ id, turn: { who: who(a.turn.who), into: a.turn.into, ...secs(a.turn.seconds) } }];
  if ("turnAll" in a) return [{ id, turn: { who: { every: a.turnAll.type }, into: a.turnAll.into, ...secs(a.turnAll.seconds) } }];
  return [
    { id: `${id}-u`, add: { what: { counter: LEVEL }, by: 1 } },
    { id, restartRoom: true },
  ];
}

function triggerFromV1(w: KitTriggerV1): Pick<KitRule, "when" | "fires"> {
  if ("touch" in w) return { when: { touch: w.touch }, fires: "while" };
  if ("allGone" in w) return { when: { test: { a: { count: w.allGone }, op: "eq", b: 0 } }, fires: "once" };
  if ("reachesBottom" in w) return { when: { edge: [w.reachesBottom, "bottom"] }, fires: "while" };
  if ("timer" in w) return { when: { after: w.timer } };
  if ("every" in w) return { when: { every: w.every } };
  if ("reaches" in w) return { when: { test: { a: { counter: w.reaches[0] }, op: "gte", b: w.reaches[1] } }, fires: "once" };
  return { when: { onTile: w.onTile }, fires: "while" };
}

/** v1 rules as v2 rules, with ids `r-<n>` (and `a-<n>-<k>` for their actions). */
export function rulesFromV1(rules: KitRuleV1[], ctx: V1Context): KitRule[] {
  return rules.map((r, n) => ({
    id: `r-${n + 1}`,
    ...triggerFromV1(r.when),
    ...(r.if?.length ? { if: r.if.map(compare) } : {}),
    then: r.then.flatMap((a, k) => actionFromV1(a, `a-${n + 1}-${k + 1}`, ctx)).slice(0, 12),
  }));
}

/** A v1 type as v2 parts. */
function typeFromV1(t: KitTypeV1, player: string | null, pace: { plus: string; max: number } | undefined): KitType {
  const isPlayer = PLAYER_BEHAVIOURS.includes(t.behaviour as Behaviour);
  const parts = presetParts(t.behaviour as Behaviour, t.speed, player, isPlayer ? undefined : pace);
  if (t.move && !isPlayer) {
    // v1's optional `move`: quarter pixels become sixteenths; walls stopped a wrapping thing.
    const react = t.move.react;
    parts.move = { vx: t.move.vx * 4, vy: t.move.vy * 4, wall: react === "wrap" ? "stop" : react, edge: react };
    delete parts.steer;
  }
  return {
    id: t.id,
    label: t.label,
    width: t.width,
    height: t.height,
    frames: t.frames,
    palette: t.palette,
    ...parts,
    ...(t.frames.length > 1 ? { display: { animate: 16 } } : {}),
  } as KitType;
}

/** v1 → v2: behaviours become parts, shooting, dropping and lives become rules and counters. */
export function migrateV1(g: KitGameV1): KitGame {
  const playerTypes = g.types.filter((t) => PLAYER_BEHAVIOURS.includes(t.behaviour as Behaviour));
  const players = playerTypes.map((t) => t.id);
  const player = players[0] ?? null;
  const ctx: V1Context = { players };
  const levels = g.rules.some((r) => r.then.some((a) => "nextLevel" in a));
  const usesLevel =
    levels || g.rules.some((r) => ("reaches" in r.when && r.when.reaches[0] === LEVEL) || (r.if ?? []).some((c) => c.counter === LEVEL));
  const pace = levels ? { plus: PACE, max: 4 } : undefined;

  const counters: KitCounter[] = [
    { id: LIVES, label: "Lives", start: g.lives },
    ...(usesLevel ? [{ id: LEVEL, label: "Level", start: 1 }] : []),
    ...(levels ? [{ id: PACE, label: "Pace", start: 0 }] : []),
    ...g.counters.map((c) => ({ id: c.id, label: c.label, start: c.start })),
  ];
  const hud: KitHud[] = [{ show: SCORE, at: "left" }, { show: LIVES, at: "right" }];
  if (g.rules.some((r) => "timer" in r.when)) hud.push({ show: "seconds", at: "middle" });
  const shown = g.counters.find((c) => c.show);
  if (shown) hud.push({ show: shown.id, at: "middle-right" });

  // Rules standing in for v1 type properties (v1 ran these while moving things, before its rules).
  const partRules: KitRule[] = [];
  const index = new Map(g.types.map((t, i) => [t.id, i]));
  const placed = (id: string) => g.room.rows.join("").split("").filter((ch) => g.room.legend[ch] === id).length;
  g.types.forEach((t, k) => {
    if (t.shoots && index.has(t.shoots)) {
      partRules.push({
        id: `${PART_RULE}shoot${k}`,
        when: { button: { joy: 1, button: 1 } },
        if: [{ a: { count: t.shoots }, op: "eq", b: 0 }],
        then: [
          { id: `a-p-shoot${k}`, create: { type: t.shoots, at: "it", place: "above" } },
          ...(g.sounds.shoot ? [{ id: `a-p-zap${k}`, sound: g.sounds.shoot }] : []),
        ],
      });
    }
  });
  g.types.forEach((t, k) => {
    if (!t.drops || !index.has(t.drops.type)) return;
    // v1 rolled once per dropper per frame; one roll at the combined chance keeps the rate close.
    const chance = Math.min(255, (t.drops.chance + 1) * Math.max(1, placed(t.id)));
    partRules.push({
      id: `${PART_RULE}drop${k}`,
      when: { every: 1, frames: true },
      if: [
        { a: { random: 255 }, op: "lt", b: chance },
        { a: { count: t.drops.type }, op: "eq", b: 0 },
      ],
      then: [{ id: `a-p-drop${k}`, create: { type: t.drops.type, at: { random: t.id }, place: "below" } }],
    });
  });
  g.types.forEach((t, k) => {
    const id = `${PART_RULE}${t.behaviour === "march" ? "march" : "fall"}${k}`;
    const r = t.move ? null : presetRule(t.behaviour as Behaviour, t, id);
    if (r) partRules.push(r);
  });
  const endRules: KitRule[] = [
    { id: `${PART_RULE}lives`, when: { test: { a: { counter: LIVES }, op: "eq", b: 0 } }, fires: "once", then: [{ id: "a-p-lives", gameOver: "lost" }] },
    // v1 made things a step faster at levels 3, 5 and 7, from the room's start.
    ...(levels
      ? PACE_LEVELS.map(
          (n, k): KitRule => ({
            id: `${PART_RULE}pace${n}`,
            when: { roomStart: true },
            if: [{ a: { counter: LEVEL }, op: "gte", b: n }],
            then: [{ id: `a-p-pace${n}`, set: { what: { counter: PACE }, to: k + 1 } }],
          }),
        )
      : []),
  ];

  return {
    kit: 2,
    title: g.title,
    palettes: g.palettes,
    background: g.background,
    wallPalette: g.wallPalette,
    textPalette: g.textPalette,
    types: g.types.map((t) => typeFromV1(t, player, pace)),
    room: { rows: g.room.rows, legend: g.room.legend },
    rooms: [],
    counters,
    hud,
    messages: [],
    // The game's own rules keep their numbers; the ones from type properties and flow follow them.
    rules: [...rulesFromV1(g.rules, ctx), ...partRules, ...endRules],
    text: g.text,
    flow: { title: true, attract: null, end: { show: [], after: 0 }, remember: false },
    cartridge: g.cartridge,
  };
}

/** A game that can't be upgraded because it was already damaged; its message is shown as is. */
class Damaged extends Error {}

const MIGRATIONS: Record<number, Migration> = {
  1: (g) => {
    const v1 = KitGameV1Schema.safeParse(g);
    if (!v1.success) throw new Damaged(v1.error.issues.map((i) => `This game file is damaged (${i.path.join(".")}: ${i.message}).`).join("\n"));
    return migrateV1(v1.data) as unknown as Record<string, unknown>;
  },
};

export const NEWER_KIT = "This game was saved by a newer version of Cartridge Studio.";

export type KitLoad = { ok: true; game: KitGame; migrated: boolean } | { ok: false; errors: string[]; newer?: boolean };

/** Brings a kit game up to KIT_VERSION, or explains why it can't be read. */
export function loadKit(input: unknown): KitLoad {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return { ok: false, errors: ["This isn't a kit game."] };
  let game = input as Record<string, unknown>;
  let version = typeof game.kit === "number" && Number.isInteger(game.kit) ? game.kit : NaN;
  if (Number.isNaN(version)) return { ok: false, errors: ["This kit game has no version number."] };
  if (version > KIT_VERSION) return { ok: false, errors: [NEWER_KIT], newer: true };
  const from = version;
  while (version < KIT_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) return { ok: false, errors: [`There's no way to upgrade a kit game from version ${version}.`] };
    try {
      game = step(structuredClone(game));
    } catch (e) {
      if (e instanceof Damaged) return { ok: false, errors: e.message.split("\n") };
      return { ok: false, errors: [`Upgrading this game from version ${version} failed: ${e instanceof Error ? e.message : String(e)}`] };
    }
    version++;
  }
  // The easier assist isn't in the (strict) schema yet: take it out for the
  // parse and put it back after (see assist.ts).
  const assist = readAssist(game);
  if (assist) {
    game = { ...game };
    delete game.assist;
  }
  const parsed = KitGameSchema.safeParse(game);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `This game file is damaged (${i.path.join(".")}: ${i.message}).`) };
  }
  if (assist?.easier) setEasier(parsed.data, true);
  return { ok: true, game: parsed.data, migrated: from !== KIT_VERSION };
}

/** Every movement preset name (re-exported for older imports). */
export { BEHAVIOURS };
