// A code project as plain files: game.bas, one PNG per graphic and a README,
// for the source export and the submission package.

import { encodeIndexedPng } from "@cartridge-studio/toolchain";
import { strToU8 } from "fflate";
import { KIT_TOOLCHAIN } from "../files/exports.ts";
import { graphicFile, type CodeProject } from "./schema.ts";

export function codeSourceFiles(project: CodeProject): Record<string, Uint8Array> {
  const files: Record<string, Uint8Array> = { "game.bas": strToU8(project.source) };
  for (const g of project.graphics) files[graphicFile(g)] = encodeIndexedPng(g.rows);
  const title = project.title || "Untitled";
  files["README.txt"] = strToU8(`${title} - source
${"=".repeat(title.length + 9)}

A Cartridge Studio code project${project.origin ? `, made from ${project.origin}` : ""}.

  game.bas   the 7800basic program
  *.png      the graphics it imports (incgraphic)

To build it yourself, install ${KIT_TOOLCHAIN} (https://github.com/7800-devtools/7800basic)
and run its build script on game.bas, for example:

  7800basic.sh game.bas

or open this folder in Atari Dev Studio. To keep editing in Cartridge Studio,
open the project's .cartridge file instead.
`);
  return files;
}

export const codeCredits = () =>
  `It was built with ${KIT_TOOLCHAIN}
  (GPL v2; ROMs built from your own source are yours, and its runtime
  routines are CC0).`;
