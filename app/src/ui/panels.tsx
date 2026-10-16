// Editor panels over the project store. Every change goes through
// useProjectStore.edit, which records undo history.

import type { Template } from "../project/schema.ts";
import { NO_SOUND, resolveParam } from "../project/validate.ts";
import { useProjectStore } from "../project/store.ts";
import { ColorPicker } from "./ColorPicker.tsx";
import { SpritePreview } from "./SpritePreview.tsx";

const COLOR_LABELS = ["Color 1", "Color 2", "Color 3"];

export function GraphicsPanel({
  template,
  selected,
  onSelect,
}: {
  template: Template;
  selected: string | null;
  onSelect: (role: string) => void;
}) {
  const project = useProjectStore((s) => s.project);
  const edit = useProjectStore((s) => s.edit);

  return (
    <section className="panel" aria-labelledby="graphics-h">
      <h2 id="graphics-h">Graphics</h2>
      <ul className="sprites">
        {template.manifest.sprites.map((role) => {
          const sprite = project.sprites.find((s) => s.role === role.role);
          if (!sprite) return null;
          const palette = project.palettes.find((p) => p.id === sprite.palette);
          return (
            <li key={role.role} className={`sprite-row ${selected === role.role ? "selected" : ""}`}>
              <button
                type="button"
                className="sprite-select"
                disabled={!role.editable}
                aria-pressed={selected === role.role}
                onClick={() => onSelect(role.role)}
              >
                <span className="sprite-thumb" aria-hidden="true">
                  <SpritePreview sprite={sprite} palette={palette} scale={role.width > 16 ? 1 : 3} />
                </span>
                <span className="sprite-meta">
                  <span className="sprite-name">{role.label}</span>
                  <span className="muted">
                    {role.width}×{role.height}
                  </span>
                </span>
              </button>
              {palette && (
                <div className="colors">
                  {palette.colors.map((c, i) => (
                    <ColorPicker
                      key={i}
                      value={c}
                      label={`${role.label} ${COLOR_LABELS[i]}`}
                      onChange={(color) =>
                        edit((d) => {
                          d.palettes.find((p) => p.id === palette.id)!.colors[i] = color;
                        })
                      }
                    />
                  ))}
                </div>
              )}
            </li>
          );
        })}
        <li className="sprite-row">
          <span className="sprite-select static">
            <span className="sprite-thumb" />
            <span className="sprite-meta">
              <span className="sprite-name">Background</span>
            </span>
          </span>
          <div className="colors">
            <ColorPicker
              value={project.background.color}
              label="Background color"
              onChange={(color) => edit((d) => void (d.background.color = color))}
            />
          </div>
        </li>
      </ul>
      <p className="muted small">Click a sprite to draw it. Palettes shared by several sprites change together.</p>
    </section>
  );
}

export function SettingsPanel({ template }: { template: Template }) {
  const project = useProjectStore((s) => s.project);
  const edit = useProjectStore((s) => s.edit);

  return (
    <section className="panel" aria-labelledby="settings-h">
      <h2 id="settings-h">Settings</h2>
      {template.manifest.params.map((p) => {
        const value = resolveParam(template.manifest, project, p.id);
        return (
          <label key={p.id} className="slider">
            <span>{p.label}</span>
            <input
              type="range"
              min={p.min}
              max={p.max}
              step={p.step}
              value={value}
              onChange={(e) => edit((d) => void (d.params[p.id] = Number(e.target.value)), `param:${p.id}`)}
            />
            <output>{value}</output>
          </label>
        );
      })}
    </section>
  );
}

export function RulesPanel({ template }: { template: Template }) {
  const rules = useProjectStore((s) => s.project.rules);
  const edit = useProjectStore((s) => s.edit);
  const { triggers, actions } = template.manifest;

  return (
    <section className="panel" aria-labelledby="rules-h">
      <h2 id="rules-h">Rules</h2>
      <ol className="rules">
        {rules.map((rule, i) => (
          <li key={i} className="rule">
            <div className="rule-when">
              <span className="kw">When</span>
              <select
                aria-label={`Rule ${i + 1} trigger`}
                value={rule.when}
                onChange={(e) => edit((d) => void (d.rules[i]!.when = e.target.value))}
              >
                {triggers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="icon"
                aria-label={`Delete rule ${i + 1}`}
                title="Delete rule"
                onClick={() => edit((d) => void d.rules.splice(i, 1))}
              >
                ×
              </button>
            </div>
            {rule.then.map((action, j) => (
              <div key={j} className="rule-then">
                <span className="kw">{j === 0 ? "then" : "and"}</span>
                <select
                  aria-label={`Rule ${i + 1} action ${j + 1}`}
                  value={action}
                  onChange={(e) => edit((d) => void (d.rules[i]!.then[j] = e.target.value))}
                >
                  {actions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
                {rule.then.length > 1 && (
                  <button
                    type="button"
                    className="icon"
                    aria-label={`Remove action ${j + 1} from rule ${i + 1}`}
                    title="Remove action"
                    onClick={() => edit((d) => void d.rules[i]!.then.splice(j, 1))}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="link"
              onClick={() => edit((d) => void d.rules[i]!.then.push(actions[0]!.id))}
            >
              + action
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="secondary"
        onClick={() => edit((d) => void d.rules.push({ when: triggers[0]!.id, then: [actions[0]!.id] }))}
      >
        Add rule
      </button>
    </section>
  );
}

export function SoundsPanel({ template }: { template: Template }) {
  const sounds = useProjectStore((s) => s.project.sounds);
  const edit = useProjectStore((s) => s.edit);
  if (template.manifest.sounds.length === 0) return null;

  return (
    <section className="panel" aria-labelledby="sounds-h">
      <h2 id="sounds-h">Sounds</h2>
      {template.manifest.sounds.map((slot) => (
        <label key={slot.slot} className="sound-row">
          <span>{slot.label}</span>
          <select
            aria-label={`${slot.label} sound`}
            value={sounds[slot.slot] ?? slot.default}
            onChange={(e) => edit((d) => void (d.sounds[slot.slot] = e.target.value))}
          >
            <option value={NO_SOUND}>None</option>
            {template.soundLibrary.map((sfx) => (
              <option key={sfx.id} value={sfx.id}>
                {sfx.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      <p className="muted small">Sound effects use the console's TIA chip. Play the game to hear them.</p>
    </section>
  );
}
