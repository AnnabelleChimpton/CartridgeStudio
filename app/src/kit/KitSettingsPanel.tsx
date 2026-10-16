// Game-wide settings for kit games: lives, colors, the words on screen, the
// shooting sound and the counters rules can keep.

import { useState } from "react";
import { SOUND_LIBRARY } from "../project/templates.ts";
import { ColorPicker } from "../ui/ColorPicker.tsx";
import { addCounter, removeCounter, showCounter } from "./edit.ts";
import { kitText } from "./generate.ts";
import { MAX_COUNTERS, type KitGame } from "./schema.ts";
import { useKitStore } from "./store.ts";

const TEXTS: { key: keyof KitGame["text"]; label: string }[] = [
  { key: "title", label: "Title screen" },
  { key: "win", label: "When you win" },
  { key: "lose", label: "When you lose" },
];

/** A name field that never stores an empty name: clearing it to retype keeps the old one until there's text. */
function NameInput({ value, label, maxLength, onChange }: { value: string; label: string; maxLength: number; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      aria-label={label}
      value={draft ?? value}
      maxLength={maxLength}
      onChange={(e) => {
        setDraft(e.target.value);
        if (e.target.value.trim()) onChange(e.target.value);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

export function KitSettingsPanel() {
  const game = useKitStore((s) => s.project);
  const edit = useKitStore((s) => s.edit);
  const wall = game.palettes.find((p) => p.id === game.wallPalette);
  const text = game.palettes.find((p) => p.id === game.textPalette);
  const shooter = game.types.some((t) => t.shoots);

  return (
    <section className="panel" aria-labelledby="kit-settings-h">
      <h2 id="kit-settings-h">Game</h2>
      <div className="field-grid">
        <label className="slider">
          <span>Lives</span>
          <input
            type="range"
            aria-label="Lives"
            min={1}
            max={9}
            value={game.lives}
            onChange={(e) => edit((d) => void (d.lives = Number(e.target.value)), "lives")}
          />
          <output>{game.lives}</output>
        </label>
        <div className="color-row">
          <span>Colors</span>
          <span className="colors">
            <ColorPicker value={game.background} label="Background color" onChange={(c) => edit((d) => void (d.background = c))} />
            {wall && (
              <>
                <ColorPicker
                  value={wall.colors[0]}
                  label="Wall color"
                  onChange={(c) => edit((d) => void (d.palettes.find((p) => p.id === d.wallPalette)!.colors[0] = c))}
                />
                <ColorPicker
                  value={wall.colors[1]}
                  label="Wall shade"
                  onChange={(c) => edit((d) => void (d.palettes.find((p) => p.id === d.wallPalette)!.colors[1] = c))}
                />
              </>
            )}
            {text && (
              <ColorPicker
                value={text.colors[0]}
                label="Text color"
                onChange={(c) => edit((d) => void (d.palettes.find((p) => p.id === d.textPalette)!.colors[0] = c))}
              />
            )}
          </span>
        </div>
        {TEXTS.map(({ key, label }) => (
          <label key={key}>
            <span>{label}</span>
            <input
              aria-label={`${label} text`}
              value={game.text[key]}
              maxLength={32}
              onChange={(e) => edit((d) => void (d.text[key] = e.target.value), `text:${key}`)}
            />
            {kitText(game.text[key]) !== game.text[key].trim().toUpperCase() && (
              <span className="muted small">Shows as “{kitText(game.text[key])}”: capitals, numbers and . ! ? - : only.</span>
            )}
          </label>
        ))}
        {shooter && (
          <label>
            <span>Shooting sound</span>
            <select
              aria-label="Shooting sound"
              value={game.sounds.shoot ?? ""}
              onChange={(e) => edit((d) => (e.target.value ? (d.sounds.shoot = e.target.value) : delete d.sounds.shoot))}
            >
              <option value="">None</option>
              {SOUND_LIBRARY.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <h3 id="kit-counters-h" className="section-h">Counters</h3>
      <p className="muted small">Numbers your rules can change and check: keys, coins, a combo. The level is always there.</p>
      {game.counters.length > 0 && (
        <ul className="counters" aria-labelledby="kit-counters-h">
          {game.counters.map((c, i) => (
            <li key={c.id} className="counter-row">
              <NameInput
                value={c.label}
                label={`Counter ${i + 1} name`}
                maxLength={20}
                onChange={(v) => edit((d) => void (d.counters[i]!.label = v), `counter:${c.id}:label`)}
              />
              <label>
                <span>starts at</span>
                <input
                  type="number"
                  className="num"
                  aria-label={`${c.label} starts at`}
                  min={0}
                  max={99}
                  value={c.start}
                  onChange={(e) =>
                    edit((d) => void (d.counters[i]!.start = Math.max(0, Math.min(99, Math.round(Number(e.target.value) || 0)))), `counter:${c.id}:start`)
                  }
                />
              </label>
              <label>
                <input type="checkbox" checked={!!c.show} onChange={(e) => edit((d) => showCounter(d, e.target.checked ? c.id : null))} />
                <span>Show on screen</span>
              </label>
              <button type="button" className="link danger" onClick={() => edit((d) => removeCounter(d, c.id))}>
                Remove {c.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {game.counters.some((c) => c.show) && <p className="muted small">Only one counter fits on screen, beside the score.</p>}
      <button type="button" className="secondary" disabled={game.counters.length >= MAX_COUNTERS} onClick={() => edit((d) => void addCounter(d))}>
        Add counter
      </button>
    </section>
  );
}
