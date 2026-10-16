// Room painter: paint walls and place things on the 20×11 room grid. Each
// cell is 8×16 game pixels, which on screen is square (160A pixels are wide).
// A drag is one undo step.

import { useEffect, useRef, useState } from "react";
import { linePoints } from "../sprite/pixels.ts";
import { ntscRgb } from "../ui/ntsc.ts";
import { SpritePreview } from "../ui/SpritePreview.tsx";
import { cellAt, isPlayer, paintCell, placements, type Brush } from "./edit.ts";
import { ZONE_BUDGET } from "./generate.ts";
import { ROOM_COLS, ROOM_ROWS, type KitGame } from "./schema.ts";
import { useKitStore } from "./store.ts";

const CELL = 22;
let strokeCounter = 0;

const css = (color: string) => {
  const [r, g, b] = ntscRgb(parseInt(color.slice(1), 16));
  return `rgb(${r} ${g} ${b})`;
};

function draw(ctx: CanvasRenderingContext2D, g: KitGame, busyRows: Set<number>) {
  ctx.fillStyle = css(g.background);
  ctx.fillRect(0, 0, ROOM_COLS * CELL, ROOM_ROWS * CELL);
  const wallColor = css(g.palettes.find((p) => p.id === g.wallPalette)?.colors[0] ?? "$0F");
  for (let row = 0; row < ROOM_ROWS; row++) {
    for (let col = 0; col < ROOM_COLS; col++) {
      if (cellAt(g, col, row) === "wall") {
        ctx.fillStyle = wallColor;
        ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
      }
    }
  }
  // Things, drawn at game scale from their cell's top-left (2:1 pixels).
  const unit = CELL / 16; // one game line
  for (const p of placements(g)) {
    const t = g.types[p.type]!;
    const colors = (g.palettes.find((x) => x.id === t.palette)?.colors ?? []).map(css);
    t.frames[0]!.forEach((rowPixels, y) => {
      for (let x = 0; x < rowPixels.length; x++) {
        const v = rowPixels.charCodeAt(x) - 48;
        if (v <= 0) continue;
        ctx.fillStyle = colors[v - 1] ?? "#fff";
        ctx.fillRect(p.col * CELL + x * unit * 2, p.row * CELL + y * unit, unit * 2, unit);
      }
    });
  }
  // Grid, and rows with more things than the console can show side by side.
  ctx.strokeStyle = "rgb(255 255 255 / 0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 1; c < ROOM_COLS; c++) {
    ctx.moveTo(c * CELL + 0.5, 0);
    ctx.lineTo(c * CELL + 0.5, ROOM_ROWS * CELL);
  }
  for (let r = 1; r < ROOM_ROWS; r++) {
    ctx.moveTo(0, r * CELL + 0.5);
    ctx.lineTo(ROOM_COLS * CELL, r * CELL + 0.5);
  }
  ctx.stroke();
  for (const r of busyRows) {
    ctx.strokeStyle = "#ff7b72";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, r * CELL + 1, ROOM_COLS * CELL - 2, CELL - 2);
  }
}

export function RoomPainter() {
  const game = useKitStore((s) => s.project);
  const edit = useKitStore((s) => s.edit);
  const [brush, setBrush] = useState<Brush>("wall");
  const canvas = useRef<HTMLCanvasElement>(null);
  const stroke = useRef<{ key: string; last: readonly [number, number]; brush: Brush } | null>(null);

  const perRow = new Map<number, number>();
  for (const p of placements(game)) perRow.set(p.row, (perRow.get(p.row) ?? 0) + 1);
  const busyRows = new Set([...perRow].filter(([, n]) => n > ZONE_BUDGET).map(([r]) => r));

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (ctx) draw(ctx, game, busyRows);
  });

  const cellOf = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const col = Math.floor(((e.clientX - rect.left) / rect.width) * ROOM_COLS);
    const row = Math.floor(((e.clientY - rect.top) / rect.height) * ROOM_ROWS);
    return [Math.min(ROOM_COLS - 1, Math.max(0, col)), Math.min(ROOM_ROWS - 1, Math.max(0, row))] as const;
  };

  /** Paints every cell from the last one to this one, so fast drags leave no gaps. */
  const paintTo = (from: readonly [number, number], to: readonly [number, number], b: Brush, key: string) =>
    edit((d) => {
      for (const [col, row] of linePoints(from[0], from[1], to[0], to[1])) paintCell(d, col, row, b);
    }, key);

  const brushes: { id: Brush; label: string }[] = [
    { id: "wall", label: "Wall" },
    { id: "erase", label: "Eraser" },
    ...game.types.map((t) => ({ id: t.id, label: t.label })),
  ];

  return (
    <section className="panel" aria-labelledby="room-h">
      <h2 id="room-h">Room</h2>
      <div className="se-toolbar brushes" role="radiogroup" aria-label="Brush">
        {brushes.map((b) => {
          const t = game.types.find((x) => x.id === b.id);
          return (
            <button
              key={b.id}
              type="button"
              role="radio"
              aria-checked={brush === b.id}
              aria-label={`Paint ${b.label}`}
              title={t && isPlayer(t) ? `${b.label} (the player: there's only one)` : b.label}
              className={`secondary brush ${brush === b.id ? "active" : ""}`}
              onClick={() => setBrush(b.id)}
            >
              {t ? (
                <SpritePreview
                  sprite={{ id: t.id, role: t.id, width: t.width, height: t.height, palette: t.palette, frames: t.frames }}
                  palette={game.palettes.find((p) => p.id === t.palette)}
                  scale={1}
                />
              ) : null}
              <span>{b.label}</span>
            </button>
          );
        })}
      </div>
      <div className="room-wrap">
        <canvas
          ref={canvas}
          width={ROOM_COLS * CELL}
          height={ROOM_ROWS * CELL}
          className="room-canvas"
          aria-label="Room grid"
          onPointerDown={(e) => {
            if (e.button !== 0 && e.button !== 2) return;
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            const key = `room:${++strokeCounter}`;
            const cell = cellOf(e);
            const b = e.button === 2 ? "erase" : brush;
            stroke.current = { key, last: cell, brush: b };
            paintTo(cell, cell, b, key);
          }}
          onPointerMove={(e) => {
            const s = stroke.current;
            if (!s) return;
            const cell = cellOf(e);
            if (cell[0] === s.last[0] && cell[1] === s.last[1]) return;
            paintTo(s.last, cell, s.brush, s.key);
            s.last = cell;
          }}
          onPointerUp={() => (stroke.current = null)}
          onPointerCancel={() => (stroke.current = null)}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
      <p className="muted small">
        Drag to paint; right-click erases. Things start in the square you put them in.
        {busyRows.size > 0 && (
          <span className="error"> Rows in red have more than {ZONE_BUDGET} things side by side.</span>
        )}
      </p>
    </section>
  );
}
