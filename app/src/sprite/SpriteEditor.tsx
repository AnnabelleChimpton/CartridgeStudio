// Pixel editor for one sprite role. It only allows what 160A can show:
// three colors from one palette plus transparent, at the role's fixed size.
// Pixels are drawn 2:1 wide, as on screen. Each stroke is one undo step.

import { useEffect, useRef, useState } from "react";
import type { Template } from "../project/schema.ts";
import { useProjectStore } from "../project/store.ts";
import { ntscCss } from "../ui/ntsc.ts";
import {
  clearFrame,
  floodFill,
  flipHorizontal,
  flipVertical,
  linePoints,
  setPixels,
  shift,
  type Frame,
  type PixelValue,
} from "./pixels.ts";

type Tool = "pencil" | "fill";

const MAX_CANVAS_WIDTH = 360;
const MAX_CELL_HEIGHT = 28;

let strokeCounter = 0;

export function SpriteEditor({ template, role }: { template: Template; role: string }) {
  const project = useProjectStore((s) => s.project);
  const edit = useProjectStore((s) => s.edit);
  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState<PixelValue>(1);
  const [frameIndex, setFrameIndex] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stroke = useRef<{ key: string; last: [number, number]; value: PixelValue } | null>(null);

  const def = template.manifest.sprites.find((s) => s.role === role)!;
  const spriteIndex = project.sprites.findIndex((s) => s.role === role);
  const sprite = project.sprites[spriteIndex]!;
  const palette = project.palettes.find((p) => p.id === sprite.palette);
  const current = Math.min(frameIndex, sprite.frames.length - 1);
  const frame = sprite.frames[current]!;

  // Cell size: 160A pixels are twice as wide as they are tall.
  const cellH = Math.max(4, Math.min(MAX_CELL_HEIGHT, Math.floor(MAX_CANVAS_WIDTH / (def.width * 2))));
  const cellW = cellH * 2;
  const width = def.width * cellW;
  const height = def.height * cellH;

  const updateFrame = (next: (f: Frame) => Frame, key?: string) =>
    edit((d) => {
      const s = d.sprites[spriteIndex]!;
      s.frames[current] = next(s.frames[current]!);
    }, key);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    for (let y = 0; y < def.height; y++) {
      for (let x = 0; x < def.width; x++) {
        const v = frame[y]!.charCodeAt(x) - 48;
        if (v === 0 || !palette) {
          // Checkerboard for transparent pixels.
          ctx.fillStyle = (x + y) % 2 ? "#23262e" : "#1a1d23";
        } else {
          ctx.fillStyle = ntscCss(palette.colors[v - 1]!);
        }
        ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
      }
    }
    ctx.strokeStyle = "rgb(255 255 255 / 0.07)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 1; x < def.width; x++) {
      ctx.moveTo(x * cellW + 0.5, 0);
      ctx.lineTo(x * cellW + 0.5, height);
    }
    for (let y = 1; y < def.height; y++) {
      ctx.moveTo(0, y * cellH + 0.5);
      ctx.lineTo(width, y * cellH + 0.5);
    }
    ctx.stroke();
  }, [frame, palette, def.width, def.height, cellW, cellH, width, height]);

  const cellAt = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * def.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * def.height);
    return [Math.min(def.width - 1, Math.max(0, x)), Math.min(def.height - 1, Math.max(0, y))];
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    const [x, y] = cellAt(e);
    const value: PixelValue = e.button === 2 ? 0 : color;
    const key = `stroke:${++strokeCounter}`;
    if (tool === "fill") {
      updateFrame((f) => floodFill(f, x, y, value), key);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    stroke.current = { key, last: [x, y], value };
    updateFrame((f) => setPixels(f, [[x, y]], value), key);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stroke.current;
    if (!s) return;
    const [x, y] = cellAt(e);
    if (x === s.last[0] && y === s.last[1]) return;
    const points = linePoints(s.last[0], s.last[1], x, y);
    s.last = [x, y];
    updateFrame((f) => setPixels(f, points, s.value), s.key);
  };

  const endStroke = () => {
    stroke.current = null;
  };

  const swatch = (v: PixelValue) => (v === 0 || !palette ? undefined : ntscCss(palette.colors[v - 1]!));

  return (
    <section className="panel sprite-editor" aria-labelledby="sprite-editor-h">
      <h2 id="sprite-editor-h">
        {def.label} <span className="muted">{def.width}×{def.height}</span>
      </h2>

      <div className="se-toolbar">
        <div className="se-group" role="radiogroup" aria-label="Drawing color">
          {([0, 1, 2, 3] as PixelValue[]).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={color === v}
              aria-label={v === 0 ? "Transparent" : `Color ${v}`}
              title={v === 0 ? "Transparent (or right-click)" : `Color ${v}`}
              className={`se-color ${v === 0 ? "transparent" : ""} ${color === v ? "selected" : ""}`}
              style={{ background: swatch(v) }}
              onClick={() => setColor(v)}
            />
          ))}
        </div>
        <div className="se-group" role="radiogroup" aria-label="Tool">
          {(["pencil", "fill"] as Tool[]).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tool === t}
              className={`secondary ${tool === t ? "active" : ""}`}
              onClick={() => setTool(t)}
            >
              {t === "pencil" ? "Pencil" : "Fill"}
            </button>
          ))}
        </div>
        <label className="se-palette">
          <span className="muted small">Palette</span>
          <select
            aria-label="Sprite palette"
            value={sprite.palette}
            onChange={(e) => edit((d) => void (d.sprites[spriteIndex]!.palette = e.target.value))}
          >
            {project.palettes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id}
              </option>
            ))}
          </select>
        </label>
      </div>

      {def.frames > 1 && (
        <div className="se-toolbar" role="tablist" aria-label="Animation frames">
          {sprite.frames.map((_, f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={f === current}
              className={`secondary ${f === current ? "active" : ""}`}
              onClick={() => setFrameIndex(f)}
            >
              Frame {f + 1}
            </button>
          ))}
          {current > 0 && (
            <button
              type="button"
              className="link"
              onClick={() => updateFrame(() => [...sprite.frames[current - 1]!])}
            >
              Copy frame {current}
            </button>
          )}
          <span className="muted small">The game alternates frames to animate.</span>
        </div>
      )}

      <div className="se-canvas-wrap">
        <canvas
          ref={canvas}
          width={width}
          height={height}
          className="se-canvas"
          aria-label={def.frames > 1 ? `${def.label} frame ${current + 1} pixels` : `${def.label} pixels`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>

      <div className="se-toolbar">
        <button type="button" className="secondary" onClick={() => updateFrame(flipHorizontal)}>
          Flip ↔
        </button>
        <button type="button" className="secondary" onClick={() => updateFrame(flipVertical)}>
          Flip ↕
        </button>
        <button type="button" className="secondary" aria-label="Shift left" onClick={() => updateFrame((f) => shift(f, -1, 0))}>
          ←
        </button>
        <button type="button" className="secondary" aria-label="Shift right" onClick={() => updateFrame((f) => shift(f, 1, 0))}>
          →
        </button>
        <button type="button" className="secondary" aria-label="Shift up" onClick={() => updateFrame((f) => shift(f, 0, -1))}>
          ↑
        </button>
        <button type="button" className="secondary" aria-label="Shift down" onClick={() => updateFrame((f) => shift(f, 0, 1))}>
          ↓
        </button>
        <span className="spacer" />
        <button type="button" className="secondary" onClick={() => updateFrame(clearFrame)}>
          Clear
        </button>
      </div>
      <p className="muted small">Right-click erases. Colors come from the palette; change them in Graphics.</p>
    </section>
  );
}
