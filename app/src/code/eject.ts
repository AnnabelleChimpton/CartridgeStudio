// Making a code project: eject a kit game or an old Classic shooter (template)
// game (its generated game.bas and graphics, frozen) or start from a small
// blank program. Ejecting is one way: the code project is a copy, and the
// original game is left alone.

import { strFromU8 } from "fflate";
import { KIT_RUNTIME_VERSION } from "../kit/generate.ts";
import { kitSourceFiles, sourceFiles } from "../files/exports.ts";
import type { KitGame } from "../kit/schema.ts";
import type { Palette, Project, SoundEffect, Template } from "../project/schema.ts";
import { manualText } from "../print/manual.ts";
import { kitManualText } from "../print/subject.ts";
import { yoursToEdit } from "./export.ts";
import { decodeIndexedPng } from "./png-decode.ts";
import { GRAPHIC_NAME, type CodeGraphic, type CodeProject } from "./schema.ts";

/** Sprites we know the palette of, to show ejected graphics in their own colors. */
interface Known {
  frames: string[][];
  palette: string;
}

const sameRows = (a: string[], b: string[]) => a.length === b.length && a.every((r, i) => r === b[i]);

/** game.bas plus PNGs (as generated) into a code project. */
export function fromSourceFiles(
  title: string,
  origin: string,
  files: Record<string, Uint8Array>,
  palettes: Palette[],
  known: Known[],
  fallbackPalette: string,
  manualText?: string,
): CodeProject {
  const graphics: CodeGraphic[] = [];
  for (const [file, data] of Object.entries(files)) {
    const name = file.replace(/\.png$/i, "");
    if (name === file || !GRAPHIC_NAME.test(name)) continue;
    const rows = decodeIndexedPng(data);
    const match = known.find((k) => k.frames.some((f) => sameRows(f, rows)));
    graphics.push({ name, rows, palette: match?.palette ?? fallbackPalette });
  }
  const source = yoursToEdit(strFromU8(files["game.bas"]!));
  const project: CodeProject = { code: 1, title, source, palettes: structuredClone(palettes), graphics, origin };
  // The print kit keeps the game's manual, so an ejected game still boxes up the same.
  if (manualText !== undefined) project.manualText = manualText;
  return project;
}

export function ejectKit(game: KitGame, library: SoundEffect[]): CodeProject {
  return fromSourceFiles(
    game.title,
    `${game.title || "a kit game"} (game kit ${KIT_RUNTIME_VERSION})`,
    kitSourceFiles(game, library),
    game.palettes,
    game.types.map((t) => ({ frames: t.frames, palette: t.palette })),
    game.textPalette,
    kitManualText(game),
  );
}

export function ejectTemplate(project: Project, template: Template): CodeProject {
  return fromSourceFiles(
    project.title,
    `${project.title || "a template game"} (${template.manifest.name} ${template.manifest.version})`,
    sourceFiles(project, template),
    project.palettes,
    project.sprites.map((s) => ({ frames: s.frames, palette: s.palette })),
    project.palettes[0]!.id,
    manualText(project, template),
  );
}

const BLANK_SOURCE = ` rem My game - a Cartridge Studio code project
 rem Arrow keys move the ship. Change anything: the preview rebuilds
 rem when you stop typing. The Reference tab lists the commands.

 displaymode 160A
 set romsize 32k

 incgraphic ship.png 160A 0 1 2 3

 dim shipx = var0
 dim shipy = var1

 rem palette 0: the ship's three colors
 P0C1 = $0F : P0C2 = $86 : P0C3 = $46
 BACKGRND = $00
 shipx = 76 : shipy = 88

main
 clearscreen
 if joy0left && shipx > 0 then shipx = shipx - 1
 if joy0right && shipx < 152 then shipx = shipx + 1
 if joy0up && shipy > 8 then shipy = shipy - 1
 if joy0down && shipy < 176 then shipy = shipy + 1
 plotsprite ship 0 shipx shipy
 drawscreen
 goto main
`;

const SHIP = [
  "00011000",
  "00011000",
  "00122100",
  "00122100",
  "01122110",
  "11222211",
  "13300331",
  "03000030",
];

export function blankCodeProject(): CodeProject {
  return {
    code: 1,
    title: "My code game",
    source: BLANK_SOURCE,
    palettes: [{ id: "ship", colors: ["$0F", "$86", "$46"] }],
    graphics: [{ name: "ship", rows: SHIP, palette: "ship" }],
  };
}
