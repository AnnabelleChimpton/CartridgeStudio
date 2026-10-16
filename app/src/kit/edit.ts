// Editing operations on kit games. Each mutates a draft (they run inside the
// store's edit recipes) and keeps the game consistent: room cells, rules and
// shoot/drop links never point at things that no longer exist.

import {
  PLAYER_BEHAVIOURS,
  ROOM_COLS,
  ROOM_ROWS,
  MAX_COUNTERS,
  type Behaviour,
  type KitAction,
  type KitGame,
  type KitRule,
  type KitType,
  TILES,
  type Tile,
} from "./schema.ts";

export const BEHAVIOUR_LABELS: Record<Behaviour, string> = {
  still: "Stays put",
  "player-lr": "Player: moves left and right",
  "player-4way": "Player: moves in 4 directions",
  "player-8way": "Player: moves in 8 directions",
  "patrol-h": "Walks left and right",
  "patrol-v": "Walks up and down",
  bounce: "Bounces around",
  chase: "Chases the player",
  march: "Marches in formation",
  fall: "Falls from the sky",
  "projectile-up": "Flies up (a shot)",
  "projectile-down": "Falls fast (a bomb)",
  flee: "Runs away from the player",
};

export const SPEED_LABELS = ["", "Slow", "Medium", "Fast", "Very fast"];

export type Brush = Tile | "erase" | string;

const LEGEND_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export const isPlayer = (t: KitType) => PLAYER_BEHAVIOURS.includes(t.behaviour);

/** The room character that places `id`, assigning a free one if needed. */
export function legendChar(g: KitGame, id: string): string {
  const existing = Object.entries(g.room.legend).find(([, v]) => v === id)?.[0];
  if (existing) return existing;
  const free = [...LEGEND_CHARS].find((c) => !(c in g.room.legend))!;
  g.room.legend[free] = id;
  return free;
}

const TILE_CHAR: Record<Tile, string> = { wall: "#", hazard: "~", goal: "*" };

function tileChar(g: KitGame, tile: Tile): string {
  const existing = Object.entries(g.room.legend).find(([, v]) => v === tile)?.[0];
  if (existing) return existing;
  g.room.legend[TILE_CHAR[tile]] = tile;
  return TILE_CHAR[tile];
}

/** What a room cell holds: "wall", a thing's id, or null when empty. */
export function cellAt(g: KitGame, col: number, row: number): string | null {
  const ch = g.room.rows[row]?.[col];
  if (!ch || ch === " " || ch === ".") return null;
  return g.room.legend[ch] ?? null;
}

function setChar(g: KitGame, col: number, row: number, ch: string) {
  const r = g.room.rows[row]!;
  g.room.rows[row] = r.slice(0, col) + ch + r.slice(col + 1);
}

export function paintCell(g: KitGame, col: number, row: number, brush: Brush) {
  if (col < 0 || row < 0 || col >= ROOM_COLS || row >= ROOM_ROWS) return;
  if (brush === "erase") return setChar(g, col, row, " ");
  if ((TILES as readonly string[]).includes(brush)) return setChar(g, col, row, tileChar(g, brush as Tile));
  const type = g.types.find((t) => t.id === brush);
  if (!type) return;
  const ch = legendChar(g, brush);
  if (isPlayer(type)) {
    // There's only ever one player: painting it moves it.
    g.room.rows = g.room.rows.map((r) => r.replaceAll(ch, " "));
  }
  setChar(g, col, row, ch);
}

/** Every placed thing: its type index and starting position (as the runtime computes it). */
export function placements(g: KitGame): { type: number; col: number; row: number }[] {
  const index = new Map(g.types.map((t, i) => [t.id, i]));
  const out: { type: number; col: number; row: number }[] = [];
  g.room.rows.forEach((r, row) =>
    [...r].forEach((ch, col) => {
      const id = g.room.legend[ch];
      if (id && id !== "wall" && index.has(id)) out.push({ type: index.get(id)!, col, row });
    }),
  );
  return out;
}

function defaultSprite(w: number, h: number): string[] {
  // A simple diamond, so a new thing is visible right away.
  return Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) => {
      const dx = Math.abs(x - (w - 1) / 2) / (w / 2);
      const dy = Math.abs(y - (h - 1) / 2) / (h / 2);
      return dx + dy < 0.75 ? "2" : dx + dy < 1 ? "1" : "0";
    }).join(""),
  );
}

/** Adds a new kind of thing and returns its id. */
export function addThing(g: KitGame, behaviour: Behaviour = "still"): string {
  let n = g.types.length + 1;
  while (g.types.some((t) => t.id === `thing-${n}`)) n++;
  const id = `thing-${n}`;
  let palette = g.palettes.find((p) => p.id !== g.textPalette && p.id !== g.wallPalette)?.id ?? g.palettes[0]!.id;
  if (g.palettes.length < 8) {
    palette = id;
    g.palettes.push({ id, colors: ["$46", "$0F", "$86"] });
  }
  g.types.push({
    id,
    label: `Thing ${n}`,
    width: 8,
    height: 8,
    frames: [defaultSprite(8, 8)],
    palette,
    behaviour,
    speed: 2,
  });
  return id;
}

const mentions = (rule: KitRule, id: string) => {
  const w = rule.when;
  return (
    ("touch" in w && w.touch.includes(id)) ||
    ("allGone" in w && w.allGone === id) ||
    ("reachesBottom" in w && w.reachesBottom === id) ||
    ("onTile" in w && w.onTile[0] === id)
  );
};

const turnsWith = (a: KitAction, id: string) =>
  ("turn" in a && a.turn.into === id) || ("turnAll" in a && (a.turnAll.type === id || a.turnAll.into === id));

/** Drops rules about `id` (in their trigger), and actions that turn things into or out of it. */
function forgetThing(g: KitGame, id: string) {
  g.rules = g.rules.filter((r) => !mentions(r, id));
  for (const r of g.rules) r.then = r.then.filter((a) => !turnsWith(a, id));
  g.rules = g.rules.filter((r) => r.then.length > 0);
}

export function removeThing(g: KitGame, id: string) {
  const ch = Object.entries(g.room.legend).find(([, v]) => v === id)?.[0];
  if (ch) {
    g.room.rows = g.room.rows.map((r) => r.replaceAll(ch, " "));
    delete g.room.legend[ch];
  }
  forgetThing(g, id);
  for (const t of g.types) {
    if (t.shoots === id) delete t.shoots;
    if (t.drops?.type === id) delete t.drops;
  }
  g.types = g.types.filter((t) => t.id !== id);
  // Drop the thing's own palette if nothing else uses it.
  const used = new Set([g.textPalette, g.wallPalette, ...g.types.map((t) => t.palette)]);
  g.palettes = g.palettes.filter((p) => used.has(p.id));
}

/** Changes a thing's size, keeping its drawing anchored at the top-left. */
export function resizeThing(g: KitGame, id: string, width: number, height: number) {
  const t = g.types.find((x) => x.id === id);
  if (!t) return;
  t.frames = t.frames.map((f) =>
    Array.from({ length: height }, (_, y) => (f[y] ?? "").padEnd(width, "0").slice(0, width)),
  );
  t.width = width;
  t.height = height;
}

export function setAnimated(g: KitGame, id: string, animated: boolean) {
  const t = g.types.find((x) => x.id === id);
  if (!t) return;
  if (animated && t.frames.length === 1) t.frames.push([...t.frames[0]!]);
  if (!animated) t.frames = [t.frames[0]!];
}

export function setBehaviour(g: KitGame, id: string, behaviour: Behaviour) {
  const t = g.types.find((x) => x.id === id);
  if (!t) return;
  const wasPlayer = isPlayer(t);
  t.behaviour = behaviour;
  if (!isPlayer(t)) delete t.shoots;
  if (isPlayer(t) && !wasPlayer) {
    // Becoming the player: any other player stops being one, and only one can be placed.
    for (const other of g.types) {
      if (other !== t && isPlayer(other)) {
        other.behaviour = "still";
        delete other.shoots;
      }
    }
    const ch = Object.entries(g.room.legend).find(([, v]) => v === id)?.[0];
    if (ch) {
      let kept = false;
      g.room.rows = g.room.rows.map((r) =>
        [...r].map((c) => (c === ch ? (kept ? " " : ((kept = true), c)) : c)).join(""),
      );
    }
  }
}

/** Adds a counter (keys, coins, combo…) and returns its id. */
export function addCounter(g: KitGame): string | null {
  if (g.counters.length >= MAX_COUNTERS) return null;
  let n = g.counters.length + 1;
  while (g.counters.some((c) => c.id === `counter-${n}`)) n++;
  const id = `counter-${n}`;
  g.counters.push({ id, label: `Counter ${n}`, start: 0 });
  return id;
}

const usesCounter = (a: KitAction, id: string) =>
  ("add" in a && a.add[0] === id) || ("take" in a && a.take[0] === id) || ("set" in a && a.set[0] === id);

/** Removes a counter along with the conditions, actions and rules that use it. */
export function removeCounter(g: KitGame, id: string) {
  g.counters = g.counters.filter((c) => c.id !== id);
  g.rules = g.rules.filter((r) => !("reaches" in r.when && r.when.reaches[0] === id));
  for (const r of g.rules) {
    r.then = r.then.filter((a) => !usesCounter(a, id));
    if (r.if) {
      r.if = r.if.filter((c) => c.counter !== id);
      if (r.if.length === 0) delete r.if;
    }
  }
  g.rules = g.rules.filter((r) => r.then.length > 0);
}

/** Shows one counter on screen (or none): only one fits beside the score. */
export function showCounter(g: KitGame, id: string | null) {
  for (const c of g.counters) {
    if (c.id === id) c.show = true;
    else delete c.show;
  }
}

/** Moves a rule to another place in the list: rules run in order, top first. */
export function moveRule(g: KitGame, from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= g.rules.length || to >= g.rules.length) return;
  const [rule] = g.rules.splice(from, 1);
  g.rules.splice(to, 0, rule!);
}
