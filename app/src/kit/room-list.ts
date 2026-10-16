// "What's in the room": each room as a plain list, for non-visual access
// (phase 2 audit). It's read from the same IR the ROM is built from, so it
// can't drift from what plays.

import { movementLabel } from "./edit.ts";
import { ROOMTOP, lowerKit } from "./ir.ts";
import type { KitGame } from "./schema.ts";

const TILE_NAMES = ["", "Wall", "Spikes", "Goal"];

/** One line per placed thing ("Dust ghost, chases the player: row 10, column 18"), then the tiles by kind. Rows and columns count from 1. */
export function whatsInTheRoom(g: KitGame, room = 0): string[] {
  const low = lowerKit(g, null);
  if (!low.ok) return [];
  const r = low.ir.rooms[room];
  if (!r) return [];
  const lines = r.spawns.map((s) => {
    const t = g.types[s.type]!;
    return `${t.label}, ${movementLabel(t).toLowerCase()}: row ${(s.y - ROOMTOP) / 16 + 1}, column ${s.x / 8 + 1}`;
  });
  for (let tile = 1; tile <= 3; tile++) {
    const cells = r.tiles.flatMap((x, i) => (x === tile ? [i] : []));
    if (!cells.length) continue;
    // Walls are many: count them; spikes and goals are few: say where.
    lines.push(
      tile === 1
        ? `${TILE_NAMES[tile]}: ${cells.length} squares`
        : `${TILE_NAMES[tile]}: ${cells.map((i) => `row ${Math.floor(i / 20) + 1} column ${(i % 20) + 1}`).join("; ")}`,
    );
  }
  const exits = Object.entries(r.exits).map(([side, to]) => `${side} to room ${to + 1}`);
  if (exits.length) lines.push(`Exits: ${exits.join(", ")}`);
  return lines;
}
