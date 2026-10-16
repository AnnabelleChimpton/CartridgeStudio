// Things: the kinds of thing in a kit game. Each has a sprite, a way of
// moving (a preset of movement parts), a speed and, for the player, what it
// shoots; anything can drop something. Parts that aren't a preset show as
// "Moves its own way", read-only until the parts editor comes.

import { PixelEditor } from "../sprite/PixelEditor.tsx";
import { SOUND_LIBRARY } from "../project/templates.ts";
import { useId, useState } from "react";
import { ColorPicker } from "../ui/ColorPicker.tsx";
import { ConfirmDialog } from "../ui/Dialog.tsx";
import { SpritePreview } from "../ui/SpritePreview.tsx";
import {
  BEHAVIOURS,
  BEHAVIOUR_LABELS,
  SPEED_LABELS,
  addThing,
  dropsOf,
  isPlayer,
  launchedBy,
  makePlayer,
  movementLabel,
  placements,
  removeThing,
  resizeThing,
  setAnimated,
  setBehaviour,
  setDrops,
  setShoots,
  setSpeed,
  shootsOf,
  type Behaviour,
} from "./edit.ts";
import { presetOf } from "./parts.ts";
import { MAX_TYPES, type KitGame, type KitType } from "./schema.ts";
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
            {thing.label} moves by its own parts (from a file or another tool), and it still works in the game. Changing them here is coming soon; picking a way to
            move above replaces them.
          </p>
        )}
        {shootsField}
        {isPlayer(thing) && sizeField}
      </div>

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

/** Sounds the kit can play, for selects. */
export const soundOptions = SOUND_LIBRARY.map((s) => ({
  id: s.id,
  label: s.label,
}));
