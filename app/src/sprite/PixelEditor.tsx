// Pixel editor for one sprite, independent of where the sprite lives. It only
// allows what 160A can show: three colors plus transparent at a fixed size,
// drawn 2:1 wide as on screen. Each stroke is one undo step (one edit key).

import { useEffect, useRef, useState, type ReactNode } from "react";
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

export interface PixelEditorProps {
  label: string;
  width: number;
  height: number;
  frames: Frame[];
  /** Palette values (`$3A`) for colors 1-3. */
  colors: readonly string[];
  /** Applies a change to one frame; `key` groups a stroke into one undo step. */
  onFrame: (index: number, next: (f: Frame) => Frame, key?: string) => void;
  /** Extra controls next to the color and tool pickers (e.g. a palette choice). */
  toolbarExtra?: ReactNode;
  /** Extra controls on the frames row (e.g. turning animation on or off). */
  framesExtra?: ReactNode;
  hint?: string;
}

export function PixelEditor({ label, width, height, frames, colors, onFrame, toolbarExtra, framesExtra, hint }: PixelEditorProps) {
  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState<PixelValue>(1);
  const [frameIndex, setFrameIndex] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stroke = useRef<{ key: string; last: [number, number]; value: PixelValue } | null>(null);

  const current = Math.min(frameIndex, frames.length - 1);
  const frame = frames[current]!;
  const update = (next: (f: Frame) => Frame, key?: string) => onFrame(current, next, key);

  // Cell size: 160A pixels are twice as wide as they are tall.
  const cellH = Math.max(4, Math.min(MAX_CELL_HEIGHT, Math.floor(MAX_CANVAS_WIDTH / (width * 2))));
  const cellW = cellH * 2;
  const canvasW = width * cellW;
  const canvasH = height * cellH;

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const v = (frame[y]?.charCodeAt(x) ?? 48) - 48;
        // Checkerboard for transparent pixels.
        ctx.fillStyle = v <= 0 || !colors[v - 1] ? ((x + y) % 2 ? "#23262e" : "#1a1d23") : ntscCss(colors[v - 1]!);
        ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
      }
    }
    ctx.strokeStyle = "rgb(255 255 255 / 0.07)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 1; x < width; x++) {
      ctx.moveTo(x * cellW + 0.5, 0);
      ctx.lineTo(x * cellW + 0.5, canvasH);
    }
    for (let y = 1; y < height; y++) {
      ctx.moveTo(0, y * cellH + 0.5);
      ctx.lineTo(canvasW, y * cellH + 0.5);
    }
    ctx.stroke();
  }, [frame, colors, width, height, cellW, cellH, canvasW, canvasH]);

  const cellAt = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * height);
    return [Math.min(width - 1, Math.max(0, x)), Math.min(height - 1, Math.max(0, y))];
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    const [x, y] = cellAt(e);
    const value: PixelValue = e.button === 2 ? 0 : color;
    const key = `stroke:${++strokeCounter}`;
    if (tool === "fill") {
      update((f) => floodFill(f, x, y, value), key);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    stroke.current = { key, last: [x, y], value };
    update((f) => setPixels(f, [[x, y]], value), key);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stroke.current;
    if (!s) return;
    const [x, y] = cellAt(e);
    if (x === s.last[0] && y === s.last[1]) return;
    const points = linePoints(s.last[0], s.last[1], x, y);
    s.last = [x, y];
    update((f) => setPixels(f, points, s.value), s.key);
  };

  const endStroke = () => {
    stroke.current = null;
  };

  const swatch = (v: PixelValue) => (v === 0 || !colors[v - 1] ? undefined : ntscCss(colors[v - 1]!));

  return (
    <>
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
        {toolbarExtra}
      </div>

      {(frames.length > 1 || framesExtra) && (
        <div className="se-toolbar" role="tablist" aria-label="Animation frames">
          {frames.length > 1 &&
            frames.map((_, f) => (
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
            <button type="button" className="link" onClick={() => update(() => [...frames[current - 1]!])}>
              Copy frame {current}
            </button>
          )}
          {framesExtra}
          {frames.length > 1 && <span className="muted small">The game alternates frames to animate.</span>}
        </div>
      )}

      <div className="se-canvas-wrap">
        <canvas
          ref={canvas}
          width={canvasW}
          height={canvasH}
          className="se-canvas"
          aria-label={frames.length > 1 ? `${label} frame ${current + 1} pixels` : `${label} pixels`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>

      <div className="se-toolbar">
        <button type="button" className="secondary" onClick={() => update(flipHorizontal)}>
          Flip ↔
        </button>
        <button type="button" className="secondary" onClick={() => update(flipVertical)}>
          Flip ↕
        </button>
        <button type="button" className="secondary" aria-label="Shift left" onClick={() => update((f) => shift(f, -1, 0))}>
          ←
        </button>
        <button type="button" className="secondary" aria-label="Shift right" onClick={() => update((f) => shift(f, 1, 0))}>
          →
        </button>
        <button type="button" className="secondary" aria-label="Shift up" onClick={() => update((f) => shift(f, 0, -1))}>
          ↑
        </button>
        <button type="button" className="secondary" aria-label="Shift down" onClick={() => update((f) => shift(f, 0, 1))}>
          ↓
        </button>
        <span className="spacer" />
        <button type="button" className="secondary" onClick={() => update(clearFrame)}>
          Clear
        </button>
      </div>
      {hint && <p className="muted small">{hint}</p>}
    </>
  );
}
