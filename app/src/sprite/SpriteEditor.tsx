// Sprite editor for one template sprite role: the shared pixel editor over the
// template project's sprites, plus the role's palette choice.

import type { Template } from "../project/schema.ts";
import { useProjectStore } from "../project/store.ts";
import { PixelEditor } from "./PixelEditor.tsx";

export function SpriteEditor({ template, role }: { template: Template; role: string }) {
  const project = useProjectStore((s) => s.project);
  const edit = useProjectStore((s) => s.edit);

  const def = template.manifest.sprites.find((s) => s.role === role)!;
  const spriteIndex = project.sprites.findIndex((s) => s.role === role);
  const sprite = project.sprites[spriteIndex]!;
  const palette = project.palettes.find((p) => p.id === sprite.palette);

  return (
    <section className="panel sprite-editor" aria-labelledby="sprite-editor-h">
      <h2 id="sprite-editor-h">
        {def.label} <span className="muted">{def.width}×{def.height}</span>
      </h2>
      <PixelEditor
        label={def.label}
        width={def.width}
        height={def.height}
        frames={sprite.frames}
        colors={palette?.colors ?? []}
        maxWidth={480}
        onFrame={(i, next, key) =>
          edit((d) => {
            const s = d.sprites[spriteIndex]!;
            s.frames[i] = next(s.frames[i]!);
          }, key)
        }
        toolbarExtra={
          <label className="se-palette">
            <span className="muted small">Palette</span>
            <select
              aria-label="Sprite palette"
              value={sprite.palette}
              onChange={(e) => edit((d) => void (d.sprites[spriteIndex]!.palette = e.target.value))}
            >
              {project.palettes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id}
                </option>
              ))}
            </select>
          </label>
        }
        hint="Right-click erases. Colors come from the palette; change them in Graphics."
      />
    </section>
  );
}
