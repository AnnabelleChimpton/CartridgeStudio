// Things: the kinds of thing in a kit game. Each has a sprite, a way of
// moving (a preset of movement parts), a speed and, for the player, what it
// shoots; anything can drop something. "Customise how it moves" opens the
// parts themselves; parts that aren't a preset show as "Moves its own way".

import { PixelEditor } from "../sprite/PixelEditor.tsx";
import { SOUND_LIBRARY } from "../project/templates.ts";
import { useId, useState } from "react";
import { ColorPicker } from "../ui/ColorPicker.tsx";
import { ConfirmDialog } from "../ui/Dialog.tsx";
import { SpritePreview } from "../ui/SpritePreview.tsx";
import {
  BEHAVIOURS,
  BEHAVIOUR_LABELS,
  GRAVITY_WAYS,
  SPEED_LABELS,
  addThing,
  dropsOf,
  gravityWay,
  isPlayer,
  launchedBy,
  makePlayer,
  moverOf,
  movementLabel,
  placements,
  removeThing,
  resizeThing,
  setAnimateRate,
  setAnimated,
  setBehaviour,
  setCap,
  setDirections,
  setDrops,
  setGravity,
  setMove,
  setMover,
  setShoots,
  setSpeed,
  setVar,
  shootsOf,
  type Behaviour,
  type GravityWay,
  type Mover,
} from "./edit.ts";
import { presetOf } from "./parts.ts";
import { AXES, EDGE_REACTIONS, MAX_OBJECTS, MAX_TYPES, WALL_REACTIONS, type KitDisplay, type KitGame, type KitType } from "./schema.ts";
import { useKitStore } from "./store.ts";

const WIDTHS = [4, 8, 12, 16];
const MAX_PALETTES = 8;
const HEIGHTS = [4, 6, 8, 10, 12, 14, 16];

/** Labels of what else uses a thing's palette (other things, the walls, the text). */
function paletteUsers(g: KitGame, thing: KitType): string[] {
  const users = g.types.filter((t) => t.id !== thing.id && t.palette === thing.palette).map((t) => t.label);
  if (g.wallPalette === thing.palette) users.push("the walls");
  if (g.textPalette === thing.palette) users.push("the score text");
  return users;
}

/** Sets a thing's colors, first giving it a palette of its own if it shares one and there's room. */
function setOwnColors(g: KitGame, id: string, colors: [string, string, string]) {
  const t = g.types.find((x) => x.id === id);
  if (!t) return;
  if (paletteUsers(g, t).length && g.palettes.length < MAX_PALETTES) {
    const base = t.id.slice(0, 20);
    let pid = base;
    for (let n = 2; g.palettes.some((p) => p.id === pid); n++) pid = `${base}-${n}`;
    g.palettes.push({ id: pid, colors });
    t.palette = pid;
  } else {
    g.palettes.find((p) => p.id === t.palette)!.colors = colors;
  }
}

function asSprite(t: KitType) {
  return {
    id: t.id,
    role: t.id,
    width: t.width,
    height: t.height,
    palette: t.palette,
    frames: t.frames,
  };
}

interface Props {
  selected: string | null;
  onSelect: (id: string | null) => void;
  /** Opens the room with this thing's brush picked. */
  onPlace: (id: string) => void;
}

export function ThingsPanel({ selected, onSelect, onPlace }: Props) {
  const game = useKitStore((s) => s.project);
  const edit = useKitStore((s) => s.edit);
  const counts = new Map<number, number>();
  for (const p of placements(game)) counts.set(p.type, (counts.get(p.type) ?? 0) + 1);
  const thing = game.types.find((t) => t.id === selected) ?? null;

  return (
    <section className="panel things-layout" aria-labelledby="things-h">
      <h2 id="things-h" className="visually-hidden">
        Things
      </h2>
      <div className="things-list">
        <ul className="sprites">
          {game.types.map((t, i) => {
            const palette = game.palettes.find((p) => p.id === t.palette);
            return (
              <li key={t.id} className={`sprite-row ${selected === t.id ? "selected" : ""}`}>
                <button type="button" className="sprite-select" aria-pressed={selected === t.id} onClick={() => onSelect(t.id)}>
                  <span className="sprite-thumb" aria-hidden="true">
                    <SpritePreview sprite={asSprite(t)} palette={palette} scale={t.width > 8 ? 2 : 3} />
                  </span>
                  <span className="sprite-meta">
                    <span className="sprite-name">{t.label}</span>
                    <span className="muted">
                      {movementLabel(t)} · {counts.get(i) ?? 0} in the room
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="toolbar">
          <button
            type="button"
            className="secondary"
            disabled={game.types.length >= MAX_TYPES}
            onClick={() => {
              let id = "";
              edit((d) => void (id = addThing(d)));
              onSelect(id || null);
            }}
          >
            Add a thing
          </button>
          {game.types.length >= MAX_TYPES && <span className="muted small">A game can have {MAX_TYPES} kinds of thing.</span>}
        </div>
        {counts.size === 0 && <p className="empty-state small">None of these are in the room yet. Open the Room tab to put them in.</p>}
      </div>

      {thing ? (
        <ThingEditor
          key={thing.id}
          thing={thing}
          placed={counts.get(game.types.indexOf(thing)) ?? 0}
          onDeleted={() => onSelect(null)}
          onPlace={() => onPlace(thing.id)}
          onSelect={onSelect}
        />
      ) : (
        <p className="empty-state">Pick a thing on the left to draw it and choose how it moves, or press Add a thing to make a new one.</p>
      )}
    </section>
  );
}

function ThingEditor({
  thing,
  placed,
  onDeleted,
  onPlace,
  onSelect,
}: {
  thing: KitType;
  placed: number;
  onDeleted: () => void;
  onPlace: () => void;
  onSelect: (id: string) => void;
}) {
  const game = useKitStore((s) => s.project);
  const edit = useKitStore((s) => s.edit);
  const index = game.types.findIndex((t) => t.id === thing.id);
  const palette = game.palettes.find((p) => p.id === thing.palette);
  const sharedWith = paletteUsers(game, thing);
  const canSplit = game.palettes.length < MAX_PALETTES;
  const others = game.types.filter((t) => t.id !== thing.id);
  const player = game.types.find(isPlayer);
  const [deleting, setDeleting] = useState(false);
  const ids = useId();
  const launched = launchedBy(game, thing.id);
  const launcher = launched && game.types.find((t) => t.id === launched.by);
  const preset = presetOf(thing);
  const [customising, setCustomising] = useState(!preset);
  const shoots = shootsOf(game, thing.id);
  const drops = dropsOf(game, thing.id);
  const change = (recipe: (t: KitType) => void, key?: string) =>
    edit((d) => {
      const t = d.types.find((x) => x.id === thing.id);
      if (t) recipe(t);
    }, key);

  const shootsField = isPlayer(thing) && (
    <label>
      <span>Shoots</span>
      <select
        value={shoots ?? ""}
        onChange={(e) => edit((d) => setShoots(d, thing.id, e.target.value || null))}
      >
        <option value="">Nothing</option>
        {others.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
    </label>
  );

  const sizeField = (
    <div className="field" role="group" aria-labelledby={`${ids}-size`}>
      <span id={`${ids}-size`}>Size</span>
      <span className="inline">
        <select
          aria-label="Width"
          value={thing.width}
          onChange={(e) => edit((d) => resizeThing(d, thing.id, Number(e.target.value), thing.height))}
        >
          {WIDTHS.map((w) => (
            <option key={w} value={w}>
              {w} wide
            </option>
          ))}
        </select>
        <select
          aria-label="Height"
          value={thing.height}
          onChange={(e) => edit((d) => resizeThing(d, thing.id, thing.width, Number(e.target.value)))}
        >
          {HEIGHTS.map((h) => (
            <option key={h} value={h}>
              {h} tall
            </option>
          ))}
        </select>
      </span>
    </div>
  );

  return (
    <div className="thing-editor">
      {(placed === 0 || !isPlayer(thing)) && (
        <div className="thing-actions">
          {placed === 0 &&
            (launched ? (
              <span className="muted small">
                {launched.how === "shoots" && launcher
                  ? `Appears when ${launcher.label} shoots.`
                  : launched.how === "drops" && launcher
                    ? `Appears when ${launcher.label} drops one.`
                    : "Appears when a rule creates one."}
              </span>
            ) : (
              <>
                <span className="small">None in the room yet.</span>
                <button type="button" className="secondary" onClick={onPlace}>
                  Put it in the room
                </button>
              </>
            ))}
          {!isPlayer(thing) && (
            <button
              type="button"
              className="secondary"
              title={player ? `${thing.label} takes over as the hero, and ${player.label}'s look moves here` : undefined}
              onClick={() => {
                let id: string | null = null;
                edit((d) => void (id = makePlayer(d, thing.id)));
                if (id) onSelect(id);
              }}
            >
              Make this my player
            </button>
          )}
        </div>
      )}
      <div className="field-grid">
        <label>
          <span>Name</span>
          <input
            value={thing.label}
            maxLength={30}
            onChange={(e) => change((t) => void (t.label = e.target.value || "Thing"), `label:${thing.id}`)}
          />
        </label>
        <label>
          <span>How it moves</span>
          <select
            value={preset?.behaviour ?? "custom"}
            onChange={(e) => e.target.value !== "custom" && edit((d) => setBehaviour(d, thing.id, e.target.value as Behaviour))}
          >
            {!preset && <option value="custom">Moves its own way</option>}
            {BEHAVIOURS.map((b) => (
              <option key={b} value={b}>
                {BEHAVIOUR_LABELS[b]}
              </option>
            ))}
          </select>
        </label>
        {!preset && (
          <p className="muted small">
            {thing.label} moves by its own parts: change them under “Customise how it moves” below. Picking a way to move above replaces them.
          </p>
        )}
        {shootsField}
        {isPlayer(thing) && sizeField}
      </div>

      <details className="parts" open={customising} onToggle={(e) => setCustomising(e.currentTarget.open)}>
        <summary>Customise how it moves</summary>
        {customising && <PartsEditor thing={thing} />}
      </details>

      <PixelEditor
        label={thing.label}
        width={thing.width}
        height={thing.height}
        frames={thing.frames}
        colors={palette?.colors ?? []}
        maxWidth={480}
        onFrame={(i, next, key) =>
          edit((d) => {
            const t = d.types[index]!;
            t.frames[i] = next(t.frames[i]!);
          }, key)
        }
        framesExtra={
          <label className="inline small">
            <input
              type="checkbox"
              checked={thing.frames.length > 1}
              onChange={(e) => edit((d) => setAnimated(d, thing.id, e.target.checked))}
            />
            Animate (2 frames)
          </label>
        }
        setColors={
          palette && {
            // A shared palette is split off so the picture's colors don't change other things.
            note: sharedWith.length
              ? canSplit
                ? `${thing.label} gets its own colors, so ${sharedWith.join(", ")} won't change.`
                : `There's no room for more colors, so this also changes ${sharedWith.join(", ")}.`
              : undefined,
            affectsOthers: sharedWith.length > 0 && !canSplit,
            apply: (colors, key) => edit((d) => setOwnColors(d, thing.id, colors), key),
          }
        }
        resize={{
          widths: WIDTHS,
          heights: HEIGHTS,
          apply: (w, h, key) => edit((d) => resizeThing(d, thing.id, w, h), key),
        }}
        hint="Right-click erases."
      />

      {palette && (
        <div className="color-row palette-row">
          <span>Change colors</span>
          <span className="colors">
            {palette.colors.map((c, i) => (
              <ColorPicker
                key={i}
                value={c}
                label={`${thing.label} color ${i + 1}`}
                onChange={(color) =>
                  edit((d) => {
                    d.palettes.find((p) => p.id === palette.id)!.colors[i] = color;
                  })
                }
              />
            ))}
          </span>
          {sharedWith.length > 0 && <span className="muted small">Shared with {sharedWith.join(", ")}.</span>}
        </div>
      )}

      <details className="more">
        <summary>More options</summary>
        <div className="field-grid">
          <label>
            <span>Speed</span>
            <select value={preset?.speed ?? 2} disabled={!preset} onChange={(e) => edit((d) => setSpeed(d, thing.id, Number(e.target.value)))}>
              {[1, 2, 3, 4].map((s) => (
                <option key={s} value={s}>
                  {SPEED_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          {!isPlayer(thing) && sizeField}
          <div className="field" role="group" aria-labelledby={`${ids}-drops`}>
            <span id={`${ids}-drops`}>Drops</span>
            <span className="inline">
              <select
                aria-label="What it drops"
                value={drops?.type ?? ""}
                onChange={(e) => edit((d) => setDrops(d, thing.id, e.target.value ? { type: e.target.value, chance: drops?.chance ?? 4 } : null))}
              >
                <option value="">Nothing</option>
                {others.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              {drops && (
                <input
                  type="range"
                  aria-label="How often it drops"
                  min={1}
                  max={40}
                  value={drops.chance}
                  onChange={(e) => edit((d) => setDrops(d, thing.id, { type: drops.type, chance: Number(e.target.value) }), `drops:${thing.id}`)}
                />
              )}
            </span>
          </div>
        </div>
        <div className="toolbar">
          <button
            type="button"
            className="secondary danger"
            onClick={() => setDeleting(true)}
          >
            Delete {thing.label}
          </button>
          {deleting && (
            <ConfirmDialog
              title={`Delete “${thing.label}”?`}
              message="It's taken out of the room and out of any rules that mention it. Undo brings it back."
              yes={`Delete ${thing.label}`}
              danger
              onClose={() => setDeleting(false)}
              onYes={() => {
                edit((d) => removeThing(d, thing.id));
                onDeleted();
              }}
            />
          )}
        </div>
      </details>
    </div>
  );
}

const MOVERS: { mover: Mover; label: string }[] = [
  { mover: "none", label: "Nothing (its own speed)" },
  { mover: "joystick", label: "The joystick" },
  { mover: "steer", label: "Steering by itself" },
];
const AXIS_LABELS: Record<(typeof AXES)[number], string> = { lr: "Left and right", ud: "Up and down", "4way": "4 directions", "8way": "8 directions" };
const GRAVITY_LABELS: Record<GravityWay, string> = { none: "None", down: "Pulls down", up: "Pulls up", right: "Pulls right", left: "Pulls left" };
const GRAVITY_STRENGTHS = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32];
const WALL_LABELS: Record<(typeof WALL_REACTIONS)[number], string> = {
  stop: "Stops",
  slide: "Slides along it",
  bounce: "Bounces off",
  turn: "Turns a corner",
  destroy: "Is removed",
  through: "Goes through walls",
};
const EDGE_LABELS: Record<(typeof EDGE_REACTIONS)[number], string> = {
  stop: "Stops",
  bounce: "Bounces off",
  wrap: "Comes back on the other side",
  turn: "Turns a corner",
  destroy: "Is removed",
  pass: "Goes off the screen",
};
const DIRECTION_LABELS: Record<NonNullable<KitDisplay["directions"]>, string> = { none: "One look", lr: "Looks left and right", "4": "Looks 4 ways" };
const ANIMATE_LABELS: [NonNullable<KitDisplay["animate"]>, string][] = [
  [4, "Very fast"],
  [8, "Fast"],
  [16, "Medium"],
  [32, "Slow"],
  ["moving", "Only while moving"],
];
const STEER_EVERY: [1 | 2 | 4, string][] = [
  [1, "Every frame"],
  [2, "Every 2nd frame"],
  [4, "Every 4th frame"],
];
const clampInt = (v: string, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number(v) || 0)));

/** The movement parts themselves: what drives it, gravity, velocity, reactions, drawing by direction, variables. */
function PartsEditor({ thing }: { thing: KitType }) {
  const game = useKitStore((s) => s.project);
  const edit = useKitStore((s) => s.edit);
  const id = thing.id;
  const mover = moverOf(thing);
  const gravity = gravityWay(thing);
  const sets = thing.display?.directions === "lr" ? 2 : thing.display?.directions === "4" ? 4 : 1;
  const animated = thing.frames.length === 2 * sets;
  const varLabel = (p: "a" | "b") => thing.vars?.[p]?.name || `its ${p}`;
  const change = (recipe: (t: KitType) => void, key?: string) =>
    edit((d) => {
      const t = d.types.find((x) => x.id === id);
      if (t) recipe(t);
    }, key);
  const speedSelect = (label: string, step: number, set: (step: number) => void) => (
    <label>
      <span>{label}</span>
      <select value={step} onChange={(e) => set(Number(e.target.value))}>
        {[1, 2, 3, 4, 5, 6].map((s) => (
          <option key={s} value={s}>
            {SPEED_LABELS[s]}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="field-grid parts-editor">
      <label>
        <span>Moved by</span>
        <select value={mover} onChange={(e) => edit((d) => setMover(d, id, e.target.value as Mover))}>
          {MOVERS.map((m) => (
            <option key={m.mover} value={m.mover}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      {thing.control && (
        <>
          <label>
            <span>Joystick moves it</span>
            <select value={thing.control.axes} onChange={(e) => change((t) => void (t.control!.axes = e.target.value as (typeof AXES)[number]))}>
              {AXES.map((a) => (
                <option key={a} value={a}>
                  {AXIS_LABELS[a]}
                </option>
              ))}
            </select>
          </label>
          {speedSelect("Joystick speed", thing.control.speed.step, (s) => change((t) => void (t.control!.speed.step = s)))}
          <label className="inline small">
            <input type="checkbox" checked={thing.control.mode === "keep"} onChange={(e) => change((t) => void (t.control!.mode = e.target.checked ? "keep" : "direct"))} />
            Keeps going the last way pushed
          </label>
        </>
      )}
      {thing.steer && (
        <>
          <div className="field" role="group" aria-label="Steering">
            <span>Steers</span>
            <span className="inline">
              <select aria-label="Toward or away" value={thing.steer.away ? "away" : "toward"} onChange={(e) => change((t) => (e.target.value === "away" ? (t.steer!.away = true) : delete t.steer!.away))}>
                <option value="toward">Toward the nearest</option>
                <option value="away">Away from the nearest</option>
              </select>
              <select aria-label="Steers toward" value={thing.steer.toward} onChange={(e) => change((t) => void (t.steer!.toward = e.target.value))}>
                {game.types.filter((t) => t.id !== id || t.id === thing.steer!.toward).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </span>
          </div>
          {speedSelect("Steering speed", thing.steer.speed.step, (s) => change((t) => void (t.steer!.speed.step = s)))}
          <label>
            <span>Changes course</span>
            <select value={thing.steer.every} onChange={(e) => change((t) => void (t.steer!.every = Number(e.target.value) as 1 | 2 | 4))}>
              {STEER_EVERY.map(([n, l]) => (
                <option key={n} value={n}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      <label>
        <span>Speed across</span>
        <input
          type="number"
          min={-112}
          max={112}
          value={thing.move.vx}
          onChange={(e) => edit((d) => setMove(d, id, { vx: clampInt(e.target.value, -112, 112) }), `vx:${id}`)}
        />
      </label>
      <label>
        <span>Speed down</span>
        <input
          type="number"
          min={-112}
          max={112}
          value={thing.move.vy}
          onChange={(e) => edit((d) => setMove(d, id, { vy: clampInt(e.target.value, -112, 112) }), `vy:${id}`)}
        />
      </label>
      <p className="muted small">Starting speeds in sixteenths of a pixel a frame: 16 is one pixel, and minus goes left or up.</p>
      <label>
        <span>Gravity</span>
        <select value={gravity} onChange={(e) => edit((d) => setGravity(d, id, e.target.value as GravityWay))}>
          {GRAVITY_WAYS.map((w) => (
            <option key={w} value={w}>
              {GRAVITY_LABELS[w]}
            </option>
          ))}
        </select>
      </label>
      {thing.gravity && (
        <>
          <label>
            <span>Gravity strength</span>
            <select
              value={typeof thing.gravity.amount === "number" ? Math.abs(thing.gravity.amount) : thing.gravity.amount.prop}
              onChange={(e) => edit((d) => setGravity(d, id, gravity, e.target.value === "a" || e.target.value === "b" ? e.target.value : Number(e.target.value)))}
            >
              {[...new Set([...GRAVITY_STRENGTHS, typeof thing.gravity.amount === "number" ? Math.abs(thing.gravity.amount) : 1])].sort((a, b) => a - b).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value="a">{varLabel("a")}</option>
              <option value="b">{varLabel("b")}</option>
            </select>
          </label>
          <label>
            <span>Fastest fall</span>
            <input
              type="number"
              min={1}
              max={112}
              value={thing.gravity.max}
              onChange={(e) => edit((d) => setGravity(d, id, gravity, undefined, clampInt(e.target.value, 1, 112)), `gmax:${id}`)}
            />
          </label>
        </>
      )}
      <label>
        <span>At a wall</span>
        <select value={thing.move.wall} onChange={(e) => edit((d) => setMove(d, id, { wall: e.target.value as KitType["move"]["wall"] }))}>
          {WALL_REACTIONS.map((r) => (
            <option key={r} value={r}>
              {WALL_LABELS[r]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>At the screen edge</span>
        <select value={thing.move.edge} onChange={(e) => edit((d) => setMove(d, id, { edge: e.target.value as KitType["move"]["edge"] }))}>
          {EDGE_REACTIONS.map((r) => (
            <option key={r} value={r}>
              {EDGE_LABELS[r]}
            </option>
          ))}
        </select>
      </label>
      {!thing.control && (
        <label className="inline small">
          <input type="checkbox" checked={!!thing.move.smooth} onChange={(e) => edit((d) => setMove(d, id, { smooth: e.target.checked }))} />
          Smooth: move every frame (costs more of the console's time)
        </label>
      )}
      <label>
        <span>Drawings</span>
        <select value={thing.display?.directions ?? "none"} onChange={(e) => edit((d) => setDirections(d, id, e.target.value as NonNullable<KitDisplay["directions"]>))}>
          {(Object.keys(DIRECTION_LABELS) as NonNullable<KitDisplay["directions"]>[]).map((k) => (
            <option key={k} value={k}>
              {DIRECTION_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      {animated && (
        <label>
          <span>Animation</span>
          <select
            value={thing.display?.animate ?? 16}
            onChange={(e) => edit((d) => setAnimateRate(d, id, (e.target.value === "moving" ? "moving" : Number(e.target.value)) as NonNullable<KitDisplay["animate"]>))}
          >
            {ANIMATE_LABELS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      )}
      {(["a", "b"] as const).map((p) => {
        const v = thing.vars?.[p];
        return (
          <div key={p} className="field" role="group" aria-label={`Variable ${p}`}>
            <span>Variable {p}</span>
            <span className="inline">
              <input
                aria-label={`Variable ${p} name`}
                placeholder="No name"
                maxLength={12}
                value={v?.name ?? ""}
                onChange={(e) => edit((d) => setVar(d, id, p, e.target.value ? { name: e.target.value, start: v?.start ?? 0 } : null), `var:${id}:${p}`)}
              />
              <span className="small">starts at</span>
              <input
                type="number"
                className="num"
                aria-label={`Variable ${p} start`}
                min={0}
                max={255}
                disabled={!v}
                value={v?.start ?? 0}
                onChange={(e) => edit((d) => setVar(d, id, p, { name: v?.name ?? p, start: clampInt(e.target.value, 0, 255) }), `var:${id}:${p}`)}
              />
            </span>
          </div>
        );
      })}
      <label>
        <span>Most at once</span>
        <select value={thing.cap ?? ""} onChange={(e) => edit((d) => setCap(d, id, e.target.value ? Number(e.target.value) : null))}>
          <option value="">As many as it needs</option>
          {Array.from({ length: MAX_OBJECTS }, (_, n) => n + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

/** Sounds the kit can play, for selects. */
export const soundOptions = SOUND_LIBRARY.map((s) => ({
  id: s.id,
  label: s.label,
}));
