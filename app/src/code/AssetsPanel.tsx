// A code project's graphics: the list, the pixel editor for the chosen one,
// and adding new ones. Adding a graphic also adds its `incgraphic` line to
// game.bas; removing one takes the line out.

import { useId, useMemo, useState } from "react";
import { PixelEditor } from "../sprite/PixelEditor.tsx";
import { ConfirmDialog } from "../ui/Dialog.tsx";
import { SpritePreview } from "../ui/SpritePreview.tsx";
import { GRAPHIC_NAME, MAX_GRAPHICS, graphicFile, type CodeGraphic, type CodeProject } from "./schema.ts";
import { addIncgraphic, removeIncgraphic } from "./source-edit.ts";
import { useCodeStore } from "./store.ts";

const WIDTHS = [4, 8, 12, 16, 20, 24, 28, 32];

/** The `rem` right above each graphic's incgraphic line, as a description ("rem Cat"). */
function descriptions(source: string): Map<string, string> {
  const out = new Map<string, string>();
  const lines = source.split("\n");
  lines.forEach((l, i) => {
    const file = /^\s+incgraphic\s+(\S+?)\.png\b/i.exec(l)?.[1];
    const rem = i > 0 ? /^\s+rem\s+(.+)$/i.exec(lines[i - 1]!)?.[1] : undefined;
    if (file && rem) out.set(file.toLowerCase(), rem.trim());
  });
  return out;
}

const asSprite = (g: CodeGraphic) => ({ id: g.name, role: g.name, width: g.rows[0]!.length, height: g.rows.length, palette: g.palette, frames: [g.rows] });

/** The next free `<base>_<n>` name, for another animation frame. */
function nextFrameName(p: CodeProject, name: string): string {
  const base = name.replace(/_\d+$/, "");
  for (let n = 1; ; n++) {
    const candidate = `${base}_${n}`;
    if (!p.graphics.some((g) => g.name.toLowerCase() === candidate.toLowerCase())) return candidate;
  }
}

export function AssetsPanel({ onShowLine }: { onShowLine: (line: number) => void }) {
  const project = useCodeStore((s) => s.project);
  const edit = useCodeStore((s) => s.edit);
  const [selected, setSelected] = useState<string | null>(() => project.graphics[0]?.name ?? null);
  const [message, setMessage] = useState<{ text: string; line?: number } | null>(null);
  const [removing, setRemoving] = useState<CodeGraphic | null>(null);
  const ids = useId();

  const about = useMemo(() => descriptions(project.source), [project.source]);
  const index = project.graphics.findIndex((g) => g.name === selected);
  const graphic = project.graphics[index];
  const palette = graphic && project.palettes.find((p) => p.id === graphic.palette);

  const add = (g: CodeGraphic, afterFile?: string) => {
    const r = addIncgraphic(project.source, graphicFile(g), afterFile);
    edit((d) => {
      d.graphics.push(g);
      d.source = r.source;
    });
    setSelected(g.name);
    setMessage({ text: `Added ${g.name}. game.bas imports it on line ${r.line}; draw it with plotsprite ${g.name.replace(/_\d+$/, "")}.`, line: r.line });
  };

  const remove = (g: CodeGraphic) => {
    edit((d) => {
      d.graphics = d.graphics.filter((x) => x.name !== g.name);
      d.source = removeIncgraphic(d.source, graphicFile(g));
    });
    setSelected(project.graphics.find((x) => x.name !== g.name)?.name ?? null);
    setMessage({ text: `Removed ${g.name}.` });
  };

  return (
    <section className="panel" aria-labelledby={`${ids}-h`}>
      <h2 id={`${ids}-h`}>Graphics</h2>
      <p className="lead muted">
        Each graphic is a PNG that game.bas imports with <code>incgraphic</code>. Colors here are for drawing; game.bas sets the
        colors the console shows, with P0C1 to P7C3.
      </p>
      <div className="graphics-layout">
        <div>
          <ul className="sprites code-graphics">
            {project.graphics.map((g) => (
              <li key={g.name} className={`sprite-row ${selected === g.name ? "selected" : ""}`}>
                <button type="button" className="sprite-select" aria-pressed={selected === g.name} onClick={() => setSelected(g.name)}>
                  <span className="sprite-thumb" aria-hidden="true">
                    <SpritePreview
                      sprite={asSprite(g)}
                      palette={project.palettes.find((p) => p.id === g.palette)}
                      scale={g.rows[0]!.length > 32 ? 1 : g.rows[0]!.length > 16 ? 2 : 3}
                    />
                  </span>
                  <span className="sprite-meta">
                    <span className="sprite-name">{g.name}</span>
                    <span className="muted">
                      {g.rows[0]!.length}×{g.rows.length}
                      {about.has(g.name.toLowerCase()) && ` · ${about.get(g.name.toLowerCase())}`}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {project.graphics.length < MAX_GRAPHICS && <AddGraphic project={project} onAdd={(g) => add(g)} />}
          <p className="muted small" role="status">
            {message?.text}{" "}
            {message?.line !== undefined && (
              <button type="button" className="link" onClick={() => onShowLine(message.line!)}>
                Show the line
              </button>
            )}
          </p>
        </div>
        {graphic && (
          <section className="panel sprite-editor" aria-labelledby={`${ids}-edit-h`}>
            <h2 id={`${ids}-edit-h`}>
              {graphic.name}{" "}
              <span className="muted">
                {graphic.rows[0]!.length}×{graphic.rows.length}
              </span>
            </h2>
            <div className="se-canvas-scroll">
              <PixelEditor
                key={graphic.name}
                label={graphic.name}
                width={graphic.rows[0]!.length}
                height={graphic.rows.length}
                frames={[graphic.rows]}
                colors={palette?.colors ?? []}
                maxWidth={480}
                onFrame={(_, next, key) =>
                  edit((d) => {
                    const g = d.graphics[index]!;
                    g.rows = next(g.rows);
                  }, key)
                }
                toolbarExtra={
                  <label className="se-palette">
                    <span className="muted small">Shown in</span>
                    <select
                      aria-label="Palette to draw in"
                      value={graphic.palette}
                      onChange={(e) => edit((d) => void (d.graphics[index]!.palette = e.target.value))}
                    >
                      {project.palettes.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.id}
                        </option>
                      ))}
                    </select>
                  </label>
                }
                hint="Right-click erases. The PNG is made from this when the game builds."
              />
            </div>
            <div className="toolbar">
              <button
                type="button"
                className="secondary"
                disabled={project.graphics.length >= MAX_GRAPHICS}
                title="A copy imported right after this one: plotsprite's frame number picks it"
                onClick={() => add({ ...structuredClone(graphic), name: nextFrameName(project, graphic.name) }, graphicFile(graphic))}
              >
                Add animation frame
              </button>
              <button type="button" className="secondary danger" onClick={() => setRemoving(graphic)}>
                Remove {graphic.name}
              </button>
            </div>
          </section>
        )}
      </div>
      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.name}?`}
          message="Its incgraphic line comes out of game.bas too; code that draws it will need changing."
          yes={`Remove ${removing.name}`}
          danger
          onYes={() => remove(removing)}
          onClose={() => setRemoving(null)}
        />
      )}
    </section>
  );
}

function AddGraphic({ project, onAdd }: { project: CodeProject; onAdd: (g: CodeGraphic) => void }) {
  const [name, setName] = useState("");
  const [width, setWidth] = useState(8);
  const [height, setHeight] = useState(8);
  const ids = useId();
  const taken = project.graphics.some((g) => g.name.toLowerCase() === name.toLowerCase());
  const problem = !name ? null : !GRAPHIC_NAME.test(name) ? "Use letters, digits and _, starting with a letter." : taken ? "That name is taken." : null;

  return (
    <form
      className="add-graphic"
      aria-labelledby={`${ids}-h`}
      onSubmit={(e) => {
        e.preventDefault();
        if (!name || problem) return;
        onAdd({ name, rows: Array.from({ length: height }, () => "0".repeat(width)), palette: project.palettes[0]!.id });
        setName("");
      }}
    >
      <h3 id={`${ids}-h`} className="section-h">
        New graphic
      </h3>
      <div className="add-graphic-fields">
        <label>
          <span>Name</span>
          <input
            type="text"
            value={name}
            maxLength={32}
            spellCheck={false}
            aria-invalid={!!problem}
            aria-describedby={`${ids}-name-hint`}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <span className={`small hint-line ${problem ? "error" : "muted"}`} id={`${ids}-name-hint`}>
          {problem ?? "Also its name in game.bas, like plotsprite enemy."}
        </span>
        <label>
          <span>Width</span>
          <select value={width} onChange={(e) => setWidth(Number(e.target.value))}>
            {WIDTHS.map((w) => (
              <option key={w} value={w}>
                {w} pixels
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Height</span>
          <input className="num" type="number" min={1} max={64} value={height} onChange={(e) => setHeight(Math.max(1, Math.min(64, Number(e.target.value) || 1)))} />
        </label>
      </div>
      <button type="submit" disabled={!name || !!problem}>
        Add graphic
      </button>
    </form>
  );
}
