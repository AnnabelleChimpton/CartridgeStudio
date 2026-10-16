// The project JSON is the single source of truth (SPEC.md, "Project data model").
// Everything else (game.bas, PNGs, ROM) is derived from it.

import { z } from "zod";

export const CURRENT_SCHEMA = 1;

/** A 7800 palette value, `$00`–`$FF`. Never RGB. */
export const ColorSchema = z.string().regex(/^\$[0-9A-Fa-f]{2}$/, "Colors are 7800 palette values like $3A");

const IdSchema = z.string().regex(/^[a-z][a-z0-9-]{0,31}$/, "Ids are short lowercase names");

export const PaletteSchema = z.object({
  id: IdSchema,
  colors: z.tuple([ColorSchema, ColorSchema, ColorSchema]),
});

export const SpriteSchema = z.object({
  id: IdSchema,
  role: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  palette: z.string(),
  /** frames[f][y] is one row of palette indices: `0` transparent, `1`–`3` colors. */
  frames: z.array(z.array(z.string())).min(1),
});

export const RuleSchema = z.object({
  when: z.string(),
  then: z.array(z.string()).min(1),
});

export const ProjectSchema = z.object({
  schema: z.literal(CURRENT_SCHEMA),
  id: z.string().min(1),
  title: z.string().max(60),
  template: z.object({ id: z.string(), version: z.string() }),
  palettes: z.array(PaletteSchema),
  sprites: z.array(SpriteSchema),
  background: z.object({ color: ColorSchema, tiles: z.null() }),
  params: z.record(z.string(), z.number()),
  rules: z.array(RuleSchema),
  sounds: z.record(z.string(), z.string()),
  cartridge: z.object({ boxStyle: z.string(), manualText: z.string().nullable() }),
});

export type Project = z.infer<typeof ProjectSchema>;
export type Palette = z.infer<typeof PaletteSchema>;
export type Sprite = z.infer<typeof SpriteSchema>;
export type Rule = z.infer<typeof RuleSchema>;

export const ManifestSchema = z.object({
  id: z.string(),
  version: z.string(),
  name: z.string(),
  description: z.string(),
  toolchain: z.string(),
  romSize: z.enum(["16k", "32k", "48k"]),
  sprites: z.array(
    z.object({
      role: z.string(),
      label: z.string(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      editable: z.boolean(),
      /** Animation frames the engine plots; the editor shows one tab per frame. */
      frames: z.number().int().min(1).max(4).default(1),
    }),
  ),
  params: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      min: z.number(),
      max: z.number(),
      step: z.number().positive(),
      default: z.number(),
    }),
  ),
  triggers: z.array(z.object({ id: z.string(), label: z.string(), hook: z.string() })),
  actions: z.array(z.object({ id: z.string(), label: z.string() })),
  /** Named moments the engine plays a sound at; the project picks a library sound (or "none") for each. */
  sounds: z.array(z.object({ slot: z.string(), label: z.string(), default: z.string() })).default([]),
  /** Manual sentences; `{paramId}` is replaced with the param's value. */
  manual: z
    .object({
      intro: z.string(),
      controls: z.array(z.string()),
      /** A fact with `if` is only included when that param isn't 0. */
      facts: z.array(z.union([z.string(), z.object({ text: z.string(), if: z.string() })])),
      gameOver: z.string(),
    })
    .optional(),
  /**
   * Game variables that behaviour tests may read, by name, mapped to engine
   * symbols. gamestate etc. are engine details; tests only use these names.
   */
  watch: z
    .record(
      z.string(),
      z.object({ symbol: z.string(), bytes: z.number().int().min(1).max(4).default(1), bcd: z.boolean().default(false) }),
    )
    .default({}),
  budgets: z.object({ maxEnemies: z.number().int(), maxPalettes: z.number().int().max(8) }),
});

export type TemplateManifest = z.infer<typeof ManifestSchema>;

/** One TIA sound effect in the shared library (templates/sfx/library.json). */
export const SoundEffectSchema = z.object({
  id: z.string(),
  label: z.string(),
  /** Frames each chunk lasts, less one (7800basic's playsfx format). */
  framesPerChunk: z.number().int().min(0).max(255),
  /** [frequency 0-31, control 0-15, volume 0-15] per chunk. */
  chunks: z.array(z.tuple([z.number().int().min(0).max(31), z.number().int().min(0).max(15), z.number().int().min(0).max(15)])).min(1),
});
export type SoundEffect = z.infer<typeof SoundEffectSchema>;

/** A loaded template package (see templates/README.md). */
export interface Template {
  manifest: TemplateManifest;
  engine: string;
  /** Snippet source by action id. */
  actions: Record<string, string>;
  sample: Project;
  /** The shared sound effect library the template's sound slots pick from. */
  soundLibrary: SoundEffect[];
}
