// Template registry. Template packages live in templates/<id>/ and are bundled
// into the app at build time.

import { z } from "zod";
import { ManifestSchema, ProjectSchema, SoundEffectSchema, type SoundEffect, type Template } from "./schema.ts";
import sfxLibrary from "@cartridge-studio/templates/sfx/library.json";
import fixedShooterManifest from "@cartridge-studio/templates/fixed-shooter/template.json";
import fixedShooterEngine from "@cartridge-studio/templates/fixed-shooter/engine.bas.hbs?raw";
import fixedShooterSample from "@cartridge-studio/templates/fixed-shooter/sample.json";

const fixedShooterActions = import.meta.glob<string>("../../../templates/fixed-shooter/actions/*.bas", {
  query: "?raw",
  import: "default",
  eager: true,
});

function actionsById(files: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files).map(([path, src]) => [path.split("/").pop()!.replace(/\.bas$/, ""), src]),
  );
}

/** Sound effects every template can use, in library order. */
export const SOUND_LIBRARY: SoundEffect[] = z.array(SoundEffectSchema).parse(sfxLibrary);

export const TEMPLATES: Record<string, Template> = {
  "fixed-shooter": {
    manifest: ManifestSchema.parse(fixedShooterManifest),
    engine: fixedShooterEngine,
    actions: actionsById(fixedShooterActions),
    sample: ProjectSchema.parse(fixedShooterSample),
    soundLibrary: SOUND_LIBRARY,
  },
};

export function getTemplate(id: string): Template {
  const t = TEMPLATES[id];
  if (!t) throw new Error(`Unknown template "${id}"`);
  return t;
}
