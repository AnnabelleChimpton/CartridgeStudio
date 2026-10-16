// Code projects (the Coder tier): game.bas written by hand, plus the graphics
// it imports. Graphics stay editable sprite frames with display palettes; the
// PNGs `incgraphic` reads are generated from them at build time. A code project
// is usually made by ejecting a kit or template game (eject.ts).

import { z } from "zod";
import { PaletteSchema } from "../project/schema.ts";

/** Graphic names become 7800basic labels and file names (`name.png`). */
export const GRAPHIC_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,31}$/;
export const MAX_SOURCE = 400_000;
export const MAX_GRAPHICS = 64;

export const CodeGraphicSchema = z
  .object({
    name: z.string().regex(GRAPHIC_NAME, "Graphic names are letters, digits and _, like enemy_1"),
    /** One row of `0`-`3` per line: `0` transparent, `1`-`3` the palette's colors (160A). */
    rows: z.array(z.string().max(256).regex(/^[0-3]+$/)).min(1).max(256),
    /** Which palette the editor shows it in; game.bas picks the real one at run time. */
    palette: z.string().max(32),
  })
  .refine((g) => g.rows.every((r) => r.length === g.rows[0]!.length), "Every row of a graphic is the same width")
  .refine((g) => g.rows[0]!.length <= 256, "Graphics are at most 256 pixels wide");
export type CodeGraphic = z.infer<typeof CodeGraphicSchema>;

export const CodeProjectSchema = z
  .object({
    code: z.literal(1),
    title: z.string().max(60),
    source: z.string().max(MAX_SOURCE),
    palettes: z.array(PaletteSchema).min(1).max(8),
    graphics: z.array(CodeGraphicSchema).max(MAX_GRAPHICS),
    /** What it was ejected from, for the top bar and the README. */
    origin: z.string().max(120).optional(),
    /** The print kit's manual, once the creator has edited the draft. */
    manualText: z.string().max(20_000).optional(),
  })
  .refine((p) => new Set(p.graphics.map((g) => g.name.toLowerCase())).size === p.graphics.length, "Two graphics have the same name");
export type CodeProject = z.infer<typeof CodeProjectSchema>;

export const isCodeProject = (g: object): g is CodeProject => "code" in g;
export const graphicFile = (g: { name: string }) => `${g.name}.png`;
