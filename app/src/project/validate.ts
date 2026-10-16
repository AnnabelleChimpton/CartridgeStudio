// Validates a project against its template. Errors are written for creators:
// they say what to fix, never how the engine works. A project that fails
// validation is never turned into code.

import type { Project, SoundEffect, Template, TemplateManifest } from "./schema.ts";
import { ProjectSchema } from "./schema.ts";

export type ValidationResult = { ok: true; project: Project } | { ok: false; errors: string[] };

const ROW = /^[0-3]*$/;

export const NO_SOUND = "none";

export function validateProject(input: unknown, template: Template): ValidationResult {
  const parsed = ProjectSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `This game file is damaged (${i.path.join(".") || "root"}: ${i.message}).`),
    };
  }
  const project = parsed.data;
  const m = template.manifest;
  const errors: string[] = [];

  if (project.template.id !== m.id) {
    errors.push(`This game was made with the "${project.template.id}" template, not "${m.name}".`);
  }

  // Palettes
  if (project.palettes.length > m.budgets.maxPalettes) {
    errors.push(`A game can use at most ${m.budgets.maxPalettes} palettes; this one has ${project.palettes.length}.`);
  }
  const paletteIds = new Set<string>();
  for (const p of project.palettes) {
    if (paletteIds.has(p.id)) errors.push(`Two palettes are both called "${p.id}".`);
    paletteIds.add(p.id);
  }

  // Sprites: exactly one per role, with the role's size and valid pixels.
  for (const role of m.sprites) {
    const sprites = project.sprites.filter((s) => s.role === role.role);
    if (sprites.length === 0) {
      errors.push(`The game needs a sprite for "${role.label}".`);
      continue;
    }
    if (sprites.length > 1) errors.push(`There is more than one "${role.label}" sprite.`);
    for (const s of sprites) {
      if (s.width !== role.width || s.height !== role.height) {
        errors.push(`"${role.label}" must be ${role.width}×${role.height} pixels.`);
      }
      if (s.width % 4 !== 0) errors.push(`"${role.label}" must be a multiple of 4 pixels wide.`);
      if (!paletteIds.has(s.palette)) errors.push(`"${role.label}" uses a palette that doesn't exist.`);
      if (s.frames.length !== role.frames) {
        errors.push(`"${role.label}" must have ${role.frames} frame${role.frames === 1 ? "" : "s"}.`);
      }
      s.frames.forEach((frame, f) => {
        const bad =
          frame.length !== s.height || frame.some((row) => row.length !== s.width || !ROW.test(row));
        if (bad) errors.push(`The pixels of "${role.label}" (frame ${f + 1}) are damaged.`);
      });
    }
  }
  for (const s of project.sprites) {
    if (!m.sprites.some((r) => r.role === s.role)) errors.push(`The template has no place for sprite "${s.id}".`);
  }

  // Params: unknown ones are errors; values are clamped later, not rejected.
  for (const id of Object.keys(project.params)) {
    if (!m.params.some((p) => p.id === id)) errors.push(`"${id}" isn't a setting this template has.`);
  }

  // Sounds: each slot picks a library sound or none.
  for (const [slot, id] of Object.entries(project.sounds)) {
    const def = m.sounds.find((s) => s.slot === slot);
    if (!def) errors.push(`"${slot}" isn't a sound this template plays.`);
    else if (id !== NO_SOUND && !template.soundLibrary.some((sfx) => sfx.id === id)) {
      errors.push(`The sound for "${def.label}" is missing from the sound library.`);
    }
  }

  // Rules use the template's closed vocabulary.
  project.rules.forEach((rule, i) => {
    if (!m.triggers.some((t) => t.id === rule.when)) {
      errors.push(`Rule ${i + 1} uses "${rule.when}", which this template doesn't understand.`);
    }
    for (const action of rule.then) {
      if (!m.actions.some((a) => a.id === action)) {
        errors.push(`Rule ${i + 1} uses the action "${action}", which this template doesn't have.`);
      }
    }
  });

  return errors.length ? { ok: false, errors } : { ok: true, project };
}

/** The library sound for a slot (the template's default if the project hasn't picked one), or null for none. */
export function resolveSound(manifest: TemplateManifest, project: Project, library: SoundEffect[], slot: string) {
  const def = manifest.sounds.find((s) => s.slot === slot);
  if (!def) throw new Error(`Template uses unknown sound slot "${slot}"`);
  const id = project.sounds[slot] ?? def.default;
  return id === NO_SOUND ? null : (library.find((s) => s.id === id) ?? null);
}

/** The param's value clamped to its range and snapped to its step; the default if unset. */
export function resolveParam(manifest: TemplateManifest, project: Project, id: string): number {
  const def = manifest.params.find((p) => p.id === id);
  if (!def) throw new Error(`Template uses unknown param "${id}"`);
  const raw = project.params[id] ?? def.default;
  const snapped = def.min + Math.round((raw - def.min) / def.step) * def.step;
  return Math.min(def.max, Math.max(def.min, snapped));
}
