// Pixel editor for one sprite, independent of where the sprite lives. It only
// allows what 160A can show: three colors plus transparent at a fixed size,
// drawn 2:1 wide as on screen. Each stroke is one undo step (one edit key).

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { arrowKeys, drawCursor, radioProps, tabProps, useGridKeyboard } from "../ui/a11y.ts";
import { ntscCss } from "../ui/ntsc.ts";
import { ImportPicture } from "./ImportPicture.tsx";
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

const MAX_CELL_HEIGHT = 32;

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
  /** Widest the drawing canvas gets, in CSS pixels. */
  maxWidth?: number;
  /**
   * Lets "Import a picture" set colors 1-3 too; `sharedWith` names the other
   * things using the palette. Called with the frame's undo key, so both are one step.
   */
  setColors?: { apply: (colors: [string, string, string], key: string) => void; sharedWith: readonly string[] };
}

export function PixelEditor({ label, width, height, frames, colors, onFrame, toolbarExtra, framesExtra, hint, maxWidth = 360, setColors }: PixelEditorProps) {
  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState<PixelValue>(1);
  const [frameIndex, setFrameIndex] = useState(0);
  const [importing, setImporting] = useState<HTMLElement | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stroke = useRef<{ key: string; last: [number, number]; value: PixelValue } | null>(null);

  const current = Math.min(frameIndex, frames.length - 1);
  const frame = frames[current]!;
  const update = (next: (f: Frame) => Frame, key?: string) => onFrame(current, next, key);
  const ids = useId();

  const colorName = (v: PixelValue) => (v === 0 ? "Transparent" : `Color ${v}`);
  const grid = useGridKeyboard({
    cols: width,
    rows: height,
    paint: (x, y, erase, key, line) => {
      const value: PixelValue = erase ? 0 : color;
      update((f) => (tool === "fill" && !line ? floodFill(f, x, y, value) : setPixels(f, [[x, y]], value)), key);
    },
    describe: (x, y) => `Column ${x + 1}, row ${y + 1}: ${colorName(((frame[y]?.charCodeAt(x) ?? 48) - 48) as PixelValue)}`,
    onOtherKey: (k) => {
      if (!["0", "1", "2", "3"].includes(k)) return false;
      setColor(Number(k) as PixelValue);
      return true;
    },
  });
  const cursor = grid.cursor;

  // Cell size: 160A pixels are twice as wide as they are tall.
  const cellH = Math.max(4, Math.min(MAX_CELL_HEIGHT, Math.floor(maxWidth / (width * 2))));
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
    if (cursor) drawCursor(ctx, cursor[0] * cellW, cursor[1] * cellH, cellW, cellH);
  }, [frame, colors, width, height, cellW, cellH, canvasW, canvasH, cursor?.[0], cursor?.[1], cursor !== null]);

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
    grid.moveTo(x, y);
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
        <div className="se-group" role="radiogroup" aria-label="Drawing color" onKeyDown={arrowKeys("radio")}>
          {([0, 1, 2, 3] as PixelValue[]).map((v) => (
            <button
              key={v}
              type="button"
              {...radioProps(color === v)}
              aria-label={colorName(v)}
              title={v === 0 ? "Transparent (or right-click)" : `Color ${v}`}
              className={`se-color ${v === 0 ? "transparent" : ""} ${color === v ? "selected" : ""}`}
              style={{ background: swatch(v) }}
              onClick={() => setColor(v)}
            />
          ))}
        </div>
        <div className="se-group" role="radiogroup" aria-label="Tool" onKeyDown={arrowKeys("radio")}>
          {(["pencil", "fill"] as Tool[]).map((t) => (
            <button
              key={t}
              type="button"
              {...radioProps(tool === t)}
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
        <div className="se-toolbar">
          {frames.length > 1 && (
            <div className="se-group" role="tablist" aria-label="Animation frames" onKeyDown={arrowKeys("tab")}>
              {frames.map((_, f) => (
                <button
                  key={f}
                  type="button"
                  {...tabProps(f === current)}
                  id={`${ids}-tab-${f}`}
                  aria-controls={`${ids}-panel`}
                  className={`secondary ${f === current ? "active" : ""}`}
                  onClick={() => setFrameIndex(f)}
                >
                  Frame {f + 1}
                </button>
              ))}
            </div>
          )}
          {current > 0 && (
            <button type="button" className="link" onClick={() => update(() => [...frames[current - 1]!])}>
              Copy frame {current}
            </button>
          )}
          {framesExtra}
          {frames.length > 1 && <span className="muted small">The game alternates frames to animate.</span>}
        </div>
      )}

      <div
        className="se-canvas-wrap"
        id={`${ids}-panel`}
        role={frames.length > 1 ? "tabpanel" : undefined}
        aria-labelledby={frames.length > 1 ? `${ids}-tab-${current}` : undefined}
      >
        <canvas
          ref={canvas}
          width={canvasW}
          height={canvasH}
          className="se-canvas"
          aria-label={frames.length > 1 ? `${label} frame ${current + 1} pixels` : `${label} pixels`}
          aria-roledescription="pixel grid"
          aria-describedby={`${ids}-keys`}
          {...grid.props}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onContextMenu={(e) => e.preventDefault()}
        />
        <span className="visually-hidden" aria-live="polite">
          {grid.announcement}
        </span>
      </div>
      <p className="muted small keys-hint" id={`${ids}-keys`}>
        Keyboard: arrows move, Space draws, Shift+arrows draw lines, Delete erases, 0–3 pick a color.
      </p>

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
        <button type="button" className="secondary" onClick={(e) => setImporting(e.currentTarget)}>
          Import a picture
        </button>
        <button type="button" className="secondary" onClick={() => update(clearFrame)}>
          Clear
        </button>
      </div>
      {hint && <p className="muted small">{hint}</p>}
      {importing && (
        <ImportPicture
          label={label}
          width={width}
          height={height}
          colors={colors}
          frameName={frames.length > 1 ? `frame ${current + 1}` : undefined}
          colorsSharedWith={setColors?.sharedWith}
          returnTo={importing}
          onClose={() => setImporting(null)}
          onApply={(next, newColors) => {
            const key = `import:${++strokeCounter}`;
            if (newColors?.length === 3) setColors?.apply(newColors as [string, string, string], key);
            update(() => next, key);
          }}
        />
      )}
    </>
  );
}
