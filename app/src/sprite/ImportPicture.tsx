// "Import a picture": turns a photo or a scanned drawing into the sprite's
// current frame. The picture comes from a file, a drop or a paste; the user
// moves and zooms a crop the sprite's on-screen shape, and sees the result
// live before using it. The maths is in import.ts.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Dialog } from "../ui/Dialog.tsx";
import { ntscCss } from "../ui/ntsc.ts";
import { radioProps, arrowKeys } from "../ui/a11y.ts";
import {
  bestColors,
  cropRect,
  detectBackground,
  displayAspect,
  makePixels,
  prepare,
  quantize,
  toSpriteSize,
  type CropMode,
  type Pixels,
  type RGB,
} from "./import.ts";
import type { Frame } from "./pixels.ts";
import "./import.css";

/** Pictures are shrunk to this many pixels on their long side before anything else. */
const MAX_SOURCE = 768;
/** The crop view's largest size, in CSS pixels. */
const VIEW_W = 320;
const VIEW_H = 240;
/** The game screen shows 160A pixels 4 CSS pixels wide (320 across at 640). */
const GAME_SCALE = 2;

export interface ImportPictureProps {
  label: string;
  width: number;
  height: number;
  /** Palette values (`$3A`) for colors 1-3. */
  colors: readonly string[];
  /** Names the frame being replaced when there are several, e.g. "frame 2". */
  frameName?: string;
  /** When set, the user can choose new colors for the palette; these are the other things that use it. */
  colorsSharedWith?: readonly string[] | null;
  onApply: (frame: Frame, colors?: string[]) => void;
  onClose: () => void;
  returnTo?: HTMLElement | null;
}

async function decode(file: Blob): Promise<Pixels> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SOURCE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return makePixels(w, h, ctx.getImageData(0, 0, w, h).data);
}

const firstImage = (files: FileList | null | undefined) => [...(files ?? [])].find((f) => f.type.startsWith("image/"));

/** Draws RGBA pixels into a canvas `scaleX` × `scaleY` CSS pixels each, over a checkerboard. */
function paint(canvas: HTMLCanvasElement | null, p: Pixels, scaleX: number, scaleY: number) {
  const ctx = canvas?.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas!.width, canvas!.height);
  for (let y = 0; y < p.height; y++) {
    for (let x = 0; x < p.width; x++) {
      const k = (y * p.width + x) * 4;
      const a = p.data[k + 3]!;
      if (a < 255) {
        ctx.fillStyle = (Math.floor((x * scaleX) / 8) + Math.floor((y * scaleY) / 8)) % 2 ? "#23262e" : "#1a1d23";
        ctx.fillRect(x * scaleX, y * scaleY, scaleX, scaleY);
      }
      if (a > 0) {
        ctx.fillStyle = `rgb(${p.data[k]} ${p.data[k + 1]} ${p.data[k + 2]} / ${a / 255})`;
        ctx.fillRect(x * scaleX, y * scaleY, scaleX, scaleY);
      }
    }
  }
}

function paintFrame(canvas: HTMLCanvasElement | null, frame: Frame, colors: readonly string[], scaleX: number, scaleY: number) {
  const ctx = canvas?.getContext("2d");
  if (!ctx) return;
  frame.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const v = Number(ch);
      ctx.fillStyle = v && colors[v - 1] ? ntscCss(colors[v - 1]!) : (x + y) % 2 ? "#23262e" : "#1a1d23";
      ctx.fillRect(x * scaleX, y * scaleY, scaleX, scaleY);
    }),
  );
}

export function ImportPicture({ label, width, height, colors, frameName, colorsSharedWith, onApply, onClose, returnTo }: ImportPictureProps) {
  const ids = useId();
  const [source, setSource] = useState<Pixels | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState<CropMode>("fill");
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number] | null>(null);
  const [keepBackground, setKeepBackground] = useState(false);
  const [tolerance, setTolerance] = useState(35);
  const [newColors, setNewColors] = useState(false);
  const [dither, setDither] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const cropCanvas = useRef<HTMLCanvasElement>(null);
  const before = useRef<HTMLCanvasElement>(null);
  const after = useRef<HTMLCanvasElement>(null);
  const actual = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);

  const aspect = displayAspect(width, height);

  const load = async (file: Blob | undefined) => {
    if (!file) {
      setError("That isn't a picture. Try a photo or a PNG or JPEG file.");
      return;
    }
    try {
      const p = await decode(file);
      setSource(p);
      setCenter(null);
      setZoom(1);
      setError("");
    } catch {
      setError("That picture couldn't be opened. Try a PNG or JPEG file.");
    }
  };

  // Once a picture is in, focus goes to the crop so the keyboard can move it.
  const hasSource = source !== null;
  useEffect(() => {
    if (hasSource) cropCanvas.current?.focus();
  }, [hasSource]);

  const result = useMemo(() => {
    if (!source) return null;
    const [cx, cy] = center ?? [source.width / 2, source.height / 2];
    const crop = cropRect(source.width, source.height, aspect, mode, zoom, cx, cy);
    const plain = prepare(source, { width, height, crop, background: null, tolerance });
    const background: RGB | null = keepBackground ? null : (detectBackground(plain) ?? detectBackground(source));
    const work = background ? prepare(source, { width, height, crop, background, tolerance }) : plain;
    const small = toSpriteSize(work, width, height);
    const picked = newColors ? bestColors(small, colors) : [];
    const palette = picked.length ? picked : [...colors];
    return { crop, plain, background, small, palette, frame: quantize(small, palette, dither) };
  }, [source, center, aspect, mode, zoom, keepBackground, tolerance, newColors, dither, width, height, colors]);

  // The crop view: the picture with the crop's frame drawn on it.
  const view = useMemo(() => {
    if (!source || !result) return null;
    const { crop } = result;
    const x0 = Math.min(0, crop.x);
    const y0 = Math.min(0, crop.y);
    const x1 = Math.max(source.width, crop.x + crop.w);
    const y1 = Math.max(source.height, crop.y + crop.h);
    const scale = Math.min(VIEW_W / (x1 - x0), VIEW_H / (y1 - y0));
    return { x0, y0, scale, w: Math.round((x1 - x0) * scale), h: Math.round((y1 - y0) * scale) };
  }, [source, result]);

  const sourceCanvas = useMemo(() => {
    if (!source) return null;
    const c = document.createElement("canvas");
    c.width = source.width;
    c.height = source.height;
    c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(source.data), source.width, source.height), 0, 0);
    return c;
  }, [source]);

  useEffect(() => {
    const ctx = cropCanvas.current?.getContext("2d");
    if (!ctx || !view || !result || !sourceCanvas) return;
    const { x0, y0, scale, w, h } = view;
    ctx.fillStyle = "#0f1115";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(sourceCanvas, -x0 * scale, -y0 * scale, sourceCanvas.width * scale, sourceCanvas.height * scale);
    const r = result.crop;
    const fx = (r.x - x0) * scale;
    const fy = (r.y - y0) * scale;
    const fw = r.w * scale;
    const fh = r.h * scale;
    // Dim what's left out, then outline the frame.
    ctx.fillStyle = "rgb(0 0 0 / 0.6)";
    ctx.fillRect(0, 0, w, fy);
    ctx.fillRect(0, fy + fh, w, h - fy - fh);
    ctx.fillRect(0, fy, fx, fh);
    ctx.fillRect(fx + fw, fy, w - fx - fw, fh);
    ctx.strokeStyle = "#f0a23a";
    ctx.lineWidth = 2;
    ctx.strokeRect(fx + 1, fy + 1, fw - 2, fh - 2);
  }, [view, result, sourceCanvas]);

  // Before and after, both at the same size, 2:1 wide like the console.
  const cell = Math.max(2, Math.min(12, Math.floor(256 / (width * 2))));
  const previewW = width * cell * 2;
  const previewH = height * cell;
  useEffect(() => {
    if (!result) return;
    paint(before.current, result.plain, previewW / result.plain.width, previewH / result.plain.height);
    paintFrame(after.current, result.frame, result.palette, cell * 2, cell);
    paintFrame(actual.current, result.frame, result.palette, GAME_SCALE * 2, GAME_SCALE);
  }, [result, previewW, previewH, cell]);

  const moveBy = (dx: number, dy: number) => {
    if (!result) return;
    const r = result.crop;
    setCenter([r.x + r.w / 2 + dx, r.y + r.h / 2 + dy]);
  };
  const zoomBy = (f: number) => setZoom((z) => Math.min(4, Math.max(1, Math.round(z * f * 10) / 10)));

  const onCropKey = (e: React.KeyboardEvent) => {
    if (!result) return;
    const step = (e.shiftKey ? 0.25 : 0.05) * Math.max(result.crop.w, result.crop.h);
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (moves[e.key]) moveBy(...moves[e.key]!);
    else if (e.key === "+" || e.key === "=") zoomBy(1.25);
    else if (e.key === "-" || e.key === "_") zoomBy(0.8);
    else return;
    e.preventDefault();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!result) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = result.crop;
    drag.current = { x: e.clientX, y: e.clientY, cx: r.x + r.w / 2, cy: r.y + r.h / 2 };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d || !view) return;
    // The canvas may be drawn smaller than its pixel size on narrow screens.
    const shown = e.currentTarget.getBoundingClientRect().width / view.w;
    const k = 1 / (view.scale * shown);
    setCenter([d.cx + (e.clientX - d.x) * k, d.cy + (e.clientY - d.y) * k]);
  };
  const endDrag = () => void (drag.current = null);

  const changing = frameName ? `${label} ${frameName}` : label;
  const shared = colorsSharedWith?.length ? colorsSharedWith.join(", ") : null;

  return (
    <Dialog title="Import a picture" onClose={onClose} returnTo={returnTo} wide>
      <div
        className={`ip ${dragging ? "dropping" : ""}`}
        onPaste={(e) => {
          const file = firstImage(e.clipboardData.files);
          if (!file) return;
          e.preventDefault();
          void load(file);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void load(firstImage(e.dataTransfer.files));
        }}
      >
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          data-testid="import-picture-file"
          onChange={(e) => {
            void load(firstImage(e.currentTarget.files));
            e.currentTarget.value = "";
          }}
        />

        {!source ? (
          <div className="ip-drop">
            <p>
              Turn a photo or a drawing into <strong>{changing}</strong>. It becomes {width}×{height} pixels in 3 colors.
            </p>
            <button type="button" onClick={() => fileInput.current?.click()}>
              Choose a picture
            </button>
            <p className="muted small">…or drag one here, or paste one (Ctrl+V or ⌘V).</p>
          </div>
        ) : (
          result &&
          view && (
            <div className="ip-grid">
              <div className="ip-col">
                <h3 className="ip-h">Choose the part to use</h3>
                <canvas
                  ref={cropCanvas}
                  width={view.w}
                  height={view.h}
                  className="ip-crop"
                  tabIndex={0}
                  role="application"
                  aria-roledescription="crop frame"
                  aria-label="Part of the picture to use"
                  aria-describedby={`${ids}-crop-keys`}
                  onKeyDown={onCropKey}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                />
                <p className="muted small" id={`${ids}-crop-keys`}>
                  Drag the frame or use the arrow keys to move it; + and − zoom.
                </p>
                <div className="se-group" role="radiogroup" aria-label="Picture size" onKeyDown={arrowKeys("radio")}>
                  {(["fill", "fit"] as CropMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      {...radioProps(mode === m)}
                      className={`secondary ${mode === m ? "active" : ""}`}
                      onClick={() => setMode(m)}
                    >
                      {m === "fill" ? "Fill the frame" : "Show it all"}
                    </button>
                  ))}
                </div>
                <label className="inline">
                  Zoom
                  <input type="range" min={1} max={4} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
                </label>

                <h3 className="ip-h">Background</h3>
                <label className="inline">
                  <input type="checkbox" checked={keepBackground} onChange={(e) => setKeepBackground(e.target.checked)} />
                  Keep the background
                </label>
                {!keepBackground && (
                  <>
                    <p className="muted small ip-bg">
                      {result.background ? (
                        <>
                          <span className="ip-swatch" style={{ background: `rgb(${result.background.join(" ")})` }} aria-hidden="true" />
                          The color around the edges becomes see-through.
                        </>
                      ) : (
                        "The picture's edges are already see-through."
                      )}
                    </p>
                    <label className="inline">
                      How much to take away
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={tolerance}
                        disabled={!result.background}
                        onChange={(e) => setTolerance(Number(e.target.value))}
                      />
                    </label>
                  </>
                )}

                <h3 className="ip-h">Colors</h3>
                {colorsSharedWith ? (
                  <div className="ip-stack" role="radiogroup" aria-label="Colors" onKeyDown={arrowKeys("radio")}>
                    {[false, true].map((pick) => (
                      <button
                        key={String(pick)}
                        type="button"
                        {...radioProps(newColors === pick)}
                        className={`secondary ${newColors === pick ? "active" : ""}`}
                        onClick={() => setNewColors(pick)}
                      >
                        {pick ? "Pick new colors from the picture" : "Use the colors it has now"}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="muted small">Uses the sprite's 3 colors.</p>
                )}
                {newColors && shared && <p className="small ip-note">This also changes the colors of {shared}.</p>}
                <label className="inline">
                  <input type="checkbox" checked={dither} onChange={(e) => setDither(e.target.checked)} />
                  Mix colors with a dot pattern
                </label>
              </div>

              <div className="ip-col">
                <h3 className="ip-h">Before and after</h3>
                <div className="ip-previews">
                  <figure>
                    <canvas ref={before} width={previewW} height={previewH} className="ip-preview" aria-hidden="true" />
                    <figcaption className="muted small">Picture</figcaption>
                  </figure>
                  <figure>
                    <canvas
                      ref={after}
                      width={previewW}
                      height={previewH}
                      className="ip-preview"
                      role="img"
                      aria-label={`${label} as it will look`}
                      data-testid="import-picture-after"
                    />
                    <figcaption className="muted small">Sprite</figcaption>
                  </figure>
                  <figure>
                    <canvas
                      ref={actual}
                      width={width * GAME_SCALE * 2}
                      height={height * GAME_SCALE}
                      className="ip-actual"
                      aria-hidden="true"
                    />
                    <figcaption className="muted small">In the game</figcaption>
                  </figure>
                </div>
                {newColors && (
                  <p className="small ip-bg">
                    New colors:{" "}
                    {result.palette.map((c, i) => (
                      <span key={i} className="ip-swatch" style={{ background: ntscCss(c) }} title={c} />
                    ))}
                    <span className="visually-hidden">{result.palette.join(", ")}</span>
                  </p>
                )}
                <p className="muted small">You can touch it up with the pencil afterwards. Undo puts the old picture back.</p>
              </div>
            </div>
          )
        )}

        {error && (
          <p className="ip-error" role="alert">
            {error}
          </p>
        )}

        <div className="ip-actions">
          {source && (
            <button type="button" className="secondary" onClick={() => fileInput.current?.click()}>
              Choose another picture
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!result}
            onClick={() => {
              if (!result) return;
              onApply(result.frame, newColors ? result.palette : undefined);
              onClose();
            }}
          >
            Use this picture
          </button>
        </div>
      </div>
    </Dialog>
  );
}
