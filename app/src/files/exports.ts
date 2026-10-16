// Exports that bundle several files (SPEC.md, "Exports"):
// - source: game.bas and its graphics, build scripts and notes, so a coder
//   can carry on in 7800basic ("Escape hatch"; see code/export.ts)
// - submission package: everything a creator sends by hand: signed ROMs,
//   print PDF, project file, source and a checklist

import { TOOLCHAIN_NAME } from "@cartridge-studio/toolchain";
import { strToU8, zipSync } from "fflate";
import { sourceFolder, type SourceFolderInput } from "../code/export.ts";
import { generate } from "../codegen/generate.ts";
import { KIT_RUNTIME_VERSION, generateKit } from "../kit/generate.ts";
import type { KitGame } from "../kit/schema.ts";
import type { Project, SoundEffect, Template } from "../project/schema.ts";

/** The toolchain every kit game is built with, from toolchain.lock.json. */
export const KIT_TOOLCHAIN = TOOLCHAIN_NAME;

const MTIME = new Date("2026-01-01T00:00:00Z");

export const slugify = (title: string) =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "game";

export type SourceExtras = Pick<SourceFolderInput, "symbols" | "cartridge">;

/** The source folder (code/export.ts): game.bas, its PNGs, build scripts and notes (paths relative to the folder). */
export function sourceFiles(project: Project, template: Template, extras: SourceExtras = {}): Record<string, Uint8Array> {
  const gen = generate(project, template);
  if (!gen.ok) throw new Error(gen.errors.join(" "));
  return sourceFolder({
    title: project.title,
    madeFrom: `the "${template.manifest.name}" template, version ${template.manifest.version}`,
    files: { "game.bas": strToU8(gen.input.source), ...gen.input.files },
    ...extras,
  });
}

/** A kit game's source folder. */
export function kitSourceFiles(game: KitGame, library: SoundEffect[], extras: SourceExtras = {}): Record<string, Uint8Array> {
  const gen = generateKit(game, library);
  if (!gen.ok) throw new Error(gen.errors.join(" "));
  return sourceFolder({
    title: game.title,
    madeFrom: `the game kit runtime, version ${KIT_RUNTIME_VERSION}`,
    files: { "game.bas": strToU8(gen.input.source), ...gen.input.files },
    ...extras,
  });
}

/** Source files as a ZIP with one folder named after the game. */
export function folderZip(title: string, suffix: string, files: Record<string, Uint8Array>): Uint8Array {
  const folder = `${slugify(title)}-${suffix}`;
  return zipSync(Object.fromEntries(Object.entries(files).map(([n, d]) => [`${folder}/${n}`, d])), { level: 9, mtime: MTIME });
}

export function sourceZip(project: Project, template: Template): Uint8Array {
  return folderZip(project.title, "source", sourceFiles(project, template));
}

/** How the package credits its tools. */
const templateCredits = (template: Template) =>
  `It was built with ${template.manifest.toolchain}
  (GPL v2; ROMs built from your own source are yours, and its runtime
  routines are CC0) and the "${template.manifest.name}" template ${template.manifest.version} (CC0).`;
const kitCredits = () =>
  `It was built with ${KIT_TOOLCHAIN}
  (GPL v2; ROMs built from your own source are yours, and its runtime
  routines are CC0) and the Cartridge Studio game kit runtime ${KIT_RUNTIME_VERSION} (CC0).`;

export const checklist = (project: Project, template: Template) => checklistText(project.title, templateCredits(template));
export const kitChecklist = (game: KitGame) => checklistText(game.title, kitCredits());

export function checklistText(title: string, credits: string): string {
  const slug = slugify(title);
  return `${title} - submission checklist
${"=".repeat(title.length + 23)}

What's in this package
  rom/${slug}.bin            signed ROM for flash carts and real consoles
  rom/${slug}.a78            ROM with an A78 header, for emulators and flash carts
  print/${slug}-print.pdf    box front and back, cartridge labels, manual
  project/${slug}.cartridge  your game file; open it in Cartridge Studio to keep editing
  source/                    game.bas and graphics, for 7800basic users

Before you send it
  [ ] Play it start to finish in the Cartridge Studio preview.
  [ ] Boot rom/${slug}.bin on real hardware with a flash cart: a 7800+ or
      2600+ (note the firmware version) and, if you can, an original 7800.
  [ ] Print the PDF at actual size (100%) and check the 1-inch square, then
      check the box and label sizes against your box and cartridge shell.
  [ ] Read the manual once more for typos.
  [ ] Decide how you want to be credited, and how people can reach you.

Sending it
  There's no automatic way to submit a game, so send this package by hand,
  for example by posting in the 7800 homebrew forum on AtariAge or by
  contacting a homebrew publisher. Include a short description, your
  credits, and which hardware you tested on.

Credits and licences
  The game is yours to license as you wish. ${credits}
  Made with Cartridge Studio. Not affiliated with or endorsed by Atari.
`;
}

export interface SubmissionInput {
  project: Project;
  template: Template;
  /** Signed ROMs. */
  a78: Uint8Array;
  bin: Uint8Array;
  pdf: Uint8Array;
  cartridgeFile: Uint8Array;
}

export function submissionZip(i: SubmissionInput): Uint8Array {
  return packageZip({
    title: i.project.title,
    checklist: checklist(i.project, i.template),
    source: sourceFiles(i.project, i.template),
    ...i,
  });
}

export interface PackageInput {
  title: string;
  checklist: string;
  source: Record<string, Uint8Array>;
  /** Signed ROMs. */
  a78: Uint8Array;
  bin: Uint8Array;
  pdf: Uint8Array;
  cartridgeFile: Uint8Array;
}

/** Everything a creator sends by hand: checklist, signed ROMs, print PDF, game file and source. */
export function packageZip(i: PackageInput): Uint8Array {
  const slug = slugify(i.title);
  const root = `${slug}-submission`;
  const files: Record<string, Uint8Array> = {
    [`${root}/CHECKLIST.txt`]: strToU8(i.checklist),
    [`${root}/rom/${slug}.bin`]: i.bin,
    [`${root}/rom/${slug}.a78`]: i.a78,
    [`${root}/print/${slug}-print.pdf`]: i.pdf,
    [`${root}/project/${slug}.cartridge`]: i.cartridgeFile,
  };
  for (const [name, data] of Object.entries(i.source)) files[`${root}/source/${name}`] = data;
  return zipSync(files, { level: 6, mtime: MTIME });
}
