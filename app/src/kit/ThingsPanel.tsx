// Things: the kinds of thing in a kit game. Each has a sprite, a behaviour,
// a speed and, for the player, what it shoots; anything can drop something.

import { PixelEditor } from "../sprite/PixelEditor.tsx";
import { SOUND_LIBRARY } from "../project/templates.ts";
import { ColorPicker } from "../ui/ColorPicker.tsx";
import { SpritePreview } from "../ui/SpritePreview.tsx";
import { BEHAVIOUR_LABELS, SPEED_LABELS, addThing, isPlayer, placements, removeThing, resizeThing, setAnimated, setBehaviour } from "./edit.ts";
import { BEHAVIOURS, MAX_TYPES, type Behaviour, type KitType } from "./schema.ts";
import { useKitStore } from "./store.ts";

const WIDTHS = [4, 8, 12, 16];
const HEIGHTS = [4, 6, 8, 10, 12, 14, 16];

function asSprite(t: KitType) {
  return { id: t.id, role: t.id, width: t.width, height: t.height, palette: t.palette, frames: t.frames };
}

export function ThingsPanel({ selected, onSelect }: { selected: string | null; onSelect: (id: string | null) => void }) {
  const game = useKitStore((s) => s.project);
  const edit = useKitStore((s) => s.edit);
  const counts = new Map<number, number>();
  for (const p of placements(game)) counts.set(p.type, (counts.get(p.type) ?? 0) + 1);
  const thing = game.types.find((t) => t.id === selected) ?? null;

  return (
    <section className="panel" aria-labelledby="things-h">
      <h2 id="things-h">Things</h2>
      <ul className="sprites">
        {game.types.map((t, i) => {
          const palette = game.palettes.find((p) => p.id === t.palette);
          return (
            <li key={t.id} className={`sprite-row ${selected === t.id ? "selected" : ""}`}>
              <button
                type="button"
                className="sprite-select"
                aria-pressed={selected === t.id}
                onClick={() => onSelect(t.id)}
              >
                <span className="sprite-thumb" aria-hidden="true">
                  <SpritePreview sprite={asSprite(t)} palette={palette} scale={t.width > 8 ? 2 : 3} />
                </span>
                <span className="sprite-meta">
                  <span className="sprite-name">{t.label}</span>
                  <span className="muted">
                    {BEHAVIOUR_LABELS[t.behaviour]} · {counts.get(i) ?? 0} in the room
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

      {thing && <ThingEditor key={thing.id} thing={thing} onDeleted={() => onSelect(null)} />}
    </section>
  );
}

function ThingEditor({ thing, onDeleted }: { thing: KitType; onDeleted: () => void }) {
  const game = useKitStore((s) => s.project);
  const edit = useKitStore((s) => s.edit);
  const index = game.types.findIndex((t) => t.id === thing.id);
  const palette = game.palettes.find((p) => p.id === thing.palette);
  const sharedWith = game.types.filter((t) => t.id !== thing.id && t.palette === thing.palette).map((t) => t.label);
  const others = game.types.filter((t) => t.id !== thing.id);
  const change = (recipe: (t: KitType) => void, key?: string) =>
    edit((d) => {
      const t = d.types.find((x) => x.id === thing.id);
      if (t) recipe(t);
    }, key);

  return (
    <div className="thing-editor">
      <div className="field-grid">
        <label>
          <span>Name</span>
          <input
            aria-label="Thing name"
            value={thing.label}
            maxLength={30}
            onChange={(e) => change((t) => void (t.label = e.target.value || "Thing"), `label:${thing.id}`)}
          />
        </label>
        <label>
          <span>Behaviour</span>
          <select
            aria-label="Behaviour"
            value={thing.behaviour}
            onChange={(e) => edit((d) => setBehaviour(d, thing.id, e.target.value as Behaviour))}
          >
            {BEHAVIOURS.map((b) => (
              <option key={b} value={b}>
                {BEHAVIOUR_LABELS[b]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Speed</span>
          <select aria-label="Speed" value={thing.speed} onChange={(e) => change((t) => void (t.speed = Number(e.target.value)))}>
            {[1, 2, 3, 4].map((s) => (
              <option key={s} value={s}>
                {SPEED_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Size</span>
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
        </label>
        {isPlayer(thing) && (
          <label>
            <span>Shoots</span>
            <select
              aria-label="Shoots"
              value={thing.shoots ?? ""}
              onChange={(e) => change((t) => (e.target.value ? (t.shoots = e.target.value) : delete t.shoots))}
            >
              <option value="">Nothing</option>
              {others.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span>Drops</span>
          <span className="inline">
            <select
              aria-label="Drops"
              value={thing.drops?.type ?? ""}
              onChange={(e) =>
                change((t) => (e.target.value ? (t.drops = { type: e.target.value, chance: t.drops?.chance ?? 4 }) : delete t.drops))
              }
            >
              <option value="">Nothing</option>
              {others.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            {thing.drops && (
              <input
                type="range"
                aria-label="How often it drops"
                min={1}
                max={40}
                value={thing.drops.chance}
                onChange={(e) => change((t) => void (t.drops!.chance = Number(e.target.value)), `drops:${thing.id}`)}
              />
            )}
          </span>
        </label>
      </div>

      <PixelEditor
        label={thing.label}
        width={thing.width}
        height={thing.height}
        frames={thing.frames}
        colors={palette?.colors ?? []}
        onFrame={(i, next, key) =>
          edit((d) => {
            const t = d.types[index]!;
            t.frames[i] = next(t.frames[i]!);
          }, key)
        }
        toolbarExtra={
          palette && (
            <span className="colors" title={sharedWith.length ? `Shared with ${sharedWith.join(", ")}` : undefined}>
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
          )
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
        hint={`Right-click erases.${sharedWith.length ? ` These colors are shared with ${sharedWith.join(", ")}.` : ""}`}
      />

      <div className="toolbar">
        <span className="spacer" />
        <button
          type="button"
          className="secondary danger"
          onClick={() => {
            if (confirm(`Delete "${thing.label}"? It's removed from the room and from any rules that mention it.`)) {
              edit((d) => removeThing(d, thing.id));
              onDeleted();
            }
          }}
        >
          Delete {thing.label}
        </button>
      </div>
    </div>
  );
}

/** Sounds the kit can play, for selects. */
export const soundOptions = SOUND_LIBRARY.map((s) => ({ id: s.id, label: s.label }));
