// Game-wide settings for kit games: lives, colors, the words on screen, the
// shooting sound and the counters rules can keep. Lives is a counter too,
// shown as a slider; the shooting sound is an action in the shooting rule.

import { Fragment, useState } from "react";
import { ColorPicker } from "../ui/ColorPicker.tsx";
import { SOUND_LIBRARY } from "../project/templates.ts";
import { addCounter, livesOf, removeCounter, setLives, setShootSound, shootSoundOf, shootsOf, showCounter, shown } from "./edit.ts";
import { EASIER_EXTRA_LIVES, easierOn, setEasier } from "./assist.ts";
import { gameContrast, thingContrast } from "./contrast.ts";
import { ContrastNotes } from "./ContrastNotes.tsx";
import { kitText } from "./generate.ts";
import { MAX_COUNTERS, MAX_HUD, type KitGame } from "./schema.ts";
import { NumberWord } from "../ui/words.ts";
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
  const lives = livesOf(game);
  const shooter = game.types.some((t) => shootsOf(game, t.id));
  const dimThings = game.types.filter((t) => thingContrast(game, t));

  return (
    <section className="panel" aria-labelledby="kit-settings-h">
      <h2 id="kit-settings-h">Game</h2>
      <div className="field-grid">
        {lives !== null && (
          <label className="slider">
            <span>Lives</span>
            <input type="range" min={1} max={9} value={lives} onChange={(e) => edit((d) => setLives(d, Number(e.target.value)), "lives")} />
            <output aria-hidden="true">{lives}</output>
          </label>
        )}
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
                <ColorPicker
                  value={wall.colors[2]}
                  label="Spike color"
                  onChange={(c) => edit((d) => void (d.palettes.find((p) => p.id === d.wallPalette)!.colors[2] = c))}
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
          <ContrastNotes warnings={gameContrast(game)} id="game-contrast" />
          {dimThings.length > 0 && (
            <p className="muted small" data-testid="things-contrast-summary">
              On this background, {dimThings.map((t) => t.label).join(", ")} may be hard to see. The Things tab suggests clearer colors.
            </p>
          )}
        </div>
        <div className="field" role="group" aria-labelledby="difficulty-h">
          <span id="difficulty-h">Difficulty</span>
          <label className="check">
            <input type="checkbox" checked={easierOn(game)} onChange={(e) => edit((d) => setEasier(d, e.target.checked))} aria-describedby="easier-hint" />{" "}
            Easier for younger players
          </label>
          <p className="muted small" id="easier-hint">
            With this on, the console's left difficulty switch picks how hard the game is. At B, the usual setting, everything but the player moves at half speed
            and you start with {EASIER_EXTRA_LIVES} extra lives. Flip it to A to play the game as you made it.
          </p>
        </div>
        {TEXTS.map(({ key, label }) => (
          <Fragment key={key}>
            <label>
              <span>{label}</span>
              <input value={game.text[key]} maxLength={32} onChange={(e) => edit((d) => void (d.text[key] = e.target.value), `text:${key}`)} />
            </label>
            {kitText(game.text[key]) !== game.text[key].trim().toUpperCase() && (
              <span className="muted small">Shows as “{kitText(game.text[key])}”: capitals, numbers and . ! ? - : only.</span>
            )}
            {key === "title" && game.text.title === game.title && (
              <span className="muted small">Follows your game's name until you change it here.</span>
            )}
          </Fragment>
        ))}
        {shooter && (
          <label>
            <span>Shooting sound</span>
            <select value={shootSoundOf(game) ?? ""} onChange={(e) => edit((d) => setShootSound(d, e.target.value || null))}>
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
      <p className="muted small">Numbers your rules can change and check: keys, coins, a combo, the level.</p>
      {game.counters.some((c) => c.id !== "lives") && (
        <ul className="counters" aria-labelledby="kit-counters-h">
          {game.counters.flatMap((c, i) => (c.id === "lives" ? [] : [[c, i] as const])).map(([c, i], shownAt) => (
            <li key={c.id} className="counter-row">
              <NameInput
                value={c.label}
                label={`Counter ${shownAt + 1} name`}
                maxLength={20}
                onChange={(v) => edit((d) => void (d.counters[i]!.label = v), `counter:${c.id}:label`)}
              />
              <label>
                <span>
                  <span className="visually-hidden">{c.label} </span>starts at
                </span>
                <input
                  type="number"
                  className="num"
                  min={0}
                  max={99}
                  value={c.start}
                  onChange={(e) =>
                    edit((d) => void (d.counters[i]!.start = Math.max(0, Math.min(99, Math.round(Number(e.target.value) || 0)))), `counter:${c.id}:start`)
                  }
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={shown(game, c.id)}
                  disabled={!shown(game, c.id) && game.hud.length >= 4}
                  onChange={(e) => edit((d) => showCounter(d, c.id, e.target.checked))}
                />
                <span>
                  Show on screen<span className="visually-hidden">: {c.label}</span>
                </span>
              </label>
              <button type="button" className="link danger" onClick={() => edit((d) => removeCounter(d, c.id))}>
                Remove {c.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {game.hud.length >= MAX_HUD && <p className="muted small">{NumberWord(MAX_HUD)} numbers fit on screen; untick one to show another.</p>}
      <button type="button" className="secondary" disabled={game.counters.length >= MAX_COUNTERS} onClick={() => edit((d) => void addCounter(d))}>
        Add counter
      </button>
    </section>
  );
}
