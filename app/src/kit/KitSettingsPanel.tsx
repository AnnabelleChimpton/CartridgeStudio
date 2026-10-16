// Game-wide settings for kit games: lives, colors, the words on screen and the
// shooting sound.

import { SOUND_LIBRARY } from "../project/templates.ts";
import { ColorPicker } from "../ui/ColorPicker.tsx";
import { kitText } from "./generate.ts";
import type { KitGame } from "./schema.ts";
import { useKitStore } from "./store.ts";

const TEXTS: { key: keyof KitGame["text"]; label: string }[] = [
  { key: "title", label: "Title screen" },
  { key: "win", label: "When you win" },
  { key: "lose", label: "When you lose" },
];

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
    </section>
  );
}
