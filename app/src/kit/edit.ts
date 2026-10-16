// Editing operations on kit games. Each mutates a draft (they run inside the
// store's edit recipes) and keeps the game consistent: room cells, rules and
// shoot/drop links never point at things that no longer exist.

import {
  PLAYER_BEHAVIOURS,
  ROOM_COLS,
  ROOM_ROWS,
  type Behaviour,
  type KitGame,
  type KitRule,
  type KitType,
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
};

export const SPEED_LABELS = ["", "Slow", "Medium", "Fast", "Very fast"];

export type Brush = "wall" | "erase" | string;

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

function wallChar(g: KitGame): string {
  const existing = Object.entries(g.room.legend).find(([, v]) => v === "wall")?.[0];
  if (existing) return existing;
  g.room.legend["#"] = "wall";
  return "#";
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
  if (brush === "wall") return setChar(g, col, row, wallChar(g));
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
  return ("touch" in w && w.touch.includes(id)) || ("allGone" in w && w.allGone === id) || ("reachesBottom" in w && w.reachesBottom === id);
};

export function removeThing(g: KitGame, id: string) {
  const ch = Object.entries(g.room.legend).find(([, v]) => v === id)?.[0];
  if (ch) {
    g.room.rows = g.room.rows.map((r) => r.replaceAll(ch, " "));
    delete g.room.legend[ch];
  }
  g.rules = g.rules.filter((r) => !mentions(r, id));
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
