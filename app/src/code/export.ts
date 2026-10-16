// The source folder every game exports, kit, template or code project: a
// game.bas that's yours to edit, its graphics, build scripts for stock
// 7800basic, notes on the compiler's pitfalls, a map of the program's labels
// and variables, and the .cartridge to carry on in Cartridge Studio.

import { TOOLCHAIN_NAME, TOOLCHAIN_URL } from "@cartridge-studio/toolchain";
import { strFromU8, strToU8 } from "fflate";

export interface SourceFolderInput {
  title: string;
  /** "the game kit runtime, version 0.2.0", "a code project"… */
  madeFrom: string;
  /** game.bas and the PNGs it imports. */
  files: Record<string, Uint8Array>;
  /** The last build's dasm symbol table, for RUNTIME.txt's addresses. */
  symbols?: string;
  /** The game file, to keep editing in Cartridge Studio. */
  cartridge?: { name: string; bytes: Uint8Array };
  /** tests.json, when the game has creator tests. */
  tests?: Uint8Array;
}

const GENERATED_NOTE = /Do not edit; regenerate from the project\./;
export const YOURS_TO_EDIT = "Yours to edit: this copy no longer follows the project.";

/** The generated header says "Do not edit"; a copy that leaves the app says the opposite. */
export const yoursToEdit = (source: string) => source.replace(GENERATED_NOTE, YOURS_TO_EDIT);

export function sourceFolder({ title, madeFrom, files, symbols, cartridge, tests }: SourceFolderInput): Record<string, Uint8Array> {
  const source = yoursToEdit(strFromU8(files["game.bas"]!));
  const out: Record<string, Uint8Array> = { ...files, "game.bas": strToU8(source) };
  out["README.txt"] = strToU8(readme(title || "Untitled", madeFrom, cartridge?.name, !!tests));
  out["PITFALLS.txt"] = strToU8(PITFALLS);
  out["build.sh"] = strToU8(BUILD_SH);
  out["build.bat"] = strToU8(BUILD_BAT.replace(/\n/g, "\r\n"));
  out["RUNTIME.txt"] = strToU8(runtimeMap(source, symbols));
  if (cartridge) out[cartridge.name] = cartridge.bytes;
  if (tests) out["tests.json"] = tests;
  return out;
}

function readme(title: string, madeFrom: string, cartridge?: string, tests = false): string {
  return `${title} - source
${"=".repeat(title.length + 9)}

Made with Cartridge Studio from ${madeFrom}.

  game.bas       the 7800basic program; it's yours to edit
  *.png          the graphics it imports (incgraphic)
  build.sh       builds it on macOS and Linux
  build.bat      builds it on Windows
  RUNTIME.txt    the program's labels, variables and memory map
  PITFALLS.txt   things 7800basic ${TOOLCHAIN_NAME.split(" ")[1]} gets wrong, and how to avoid them${tests ? "\n  tests.json     your checks: joystick input from power-on, then what should be true;\n                 variables are named by dasm symbol in its \"watch\" map" : ""}${cartridge ? `\n  ${cartridge.padEnd(14)} open it in Cartridge Studio to keep editing there` : ""}

To build it, install ${TOOLCHAIN_NAME}
(${TOOLCHAIN_URL})
and set bas7800dir as its install guide says, then run build.sh or build.bat.
The folder also opens as it is in Atari Dev Studio.

The game is yours. 7800basic's own routines built into the ROM are CC0
(see 7800basic's LICENSE.txt).
`;
}

const PITFALLS = `7800basic pitfalls
==================

Found while writing Cartridge Studio's runtimes, with ${TOOLCHAIN_NAME}. Each
one compiles, or nearly, and then misbehaves.

1. Multiplying by a const name (x = col * SPACING) makes the compiler loop
   forever. Multiply by a literal number.
2. A const used as a plotsprite or boxcollision position is read as a
   memory address. Copy it into a variable first.
3. boxcollision's widths and heights must be numbers, not variables.
4. Set characterset before plotvalue, or the digits come from the wrong
   place.
5. "if rand < n" doesn't draw a new random number for the test. Store rand
   in a variable first.
6. Score sums take a const's value as written: score0 = score0 + 30 adds
   BCD $30, but a const of 30 adds binary 30. Write score consts in BCD
   (const POINTS = $30).
7. The single letters a-z are 7800basic's own variables. Naming yours i, j,
   t... clashes at assembly time ("EQU: Value mismatch"). Use longer names.
8. An if can't chain three || (or &&) conditions; split it into two ifs.
`;

const BUILD_SH = `#!/bin/sh
# Builds game.bas with stock 7800basic. Needs bas7800dir set (see 7800basic's
# install guide); writes game.bas.a78 and game.bas.bin next to it.
cd "$(dirname "$0")" || exit 1
if [ -z "$bas7800dir" ]; then
  echo "Set bas7800dir to your 7800basic folder first." >&2
  exit 1
fi
PATH="$bas7800dir:$PATH"
exec 7800basic.sh game.bas
`;

const BUILD_BAT = `@echo off
rem Builds game.bas with stock 7800basic. Needs bas7800dir set (see 7800basic's
rem install guide); writes game.bas.a78 and game.bas.bin next to it.
cd /d "%~dp0"
if "%bas7800dir%"=="" (
  echo Set bas7800dir to your 7800basic folder first.
  exit /b 1
)
set PATH=%bas7800dir%;%PATH%
7800bas.bat game.bas
`;

/** Labels, constants, variables and graphics in game.bas, with addresses from the symbol table when there is one. */
export function runtimeMap(source: string, symbols?: string): string {
  const address = new Map<string, number>();
  for (const line of (symbols ?? "").split("\n")) {
    const m = /^(?:\d*\.)?([A-Za-z_]\w*)\s+([0-9a-f]{4})\b/i.exec(line);
    if (m && !address.has(m[1]!)) address.set(m[1]!, parseInt(m[2]!, 16));
  }
  const hex = (n?: number) => (n === undefined ? "     " : `$${n.toString(16).toUpperCase().padStart(4, "0")}`);
  const lines = source.split("\n");
  const labels: string[] = [];
  const consts: string[] = [];
  const vars: { name: string; at?: number; note: string }[] = [];
  const graphics: string[] = [];
  lines.forEach((l, i) => {
    let m: RegExpExecArray | null;
    if ((m = /^([A-Za-z_]\w*)\s*$/.exec(l)) && m[1]!.toLowerCase() !== "end") labels.push(`  ${hex(address.get(m[1]!))}  ${m[1]}  (line ${i + 1})`);
    else if ((m = /^\s+const\s+(\w+)\s*=\s*(\S+)/i.exec(l))) consts.push(`  ${m[1]} = ${m[2]}`);
    else if ((m = /^\s+dim\s+(\w+)\s*=\s*(\S+)/i.exec(l))) vars.push({ name: m[1]!, at: address.get(m[1]!), note: `dim = ${m[2]}` });
    else if ((m = /^\s+autodim\s+(byte|word|\w+)\s+(\w+)/i.exec(l)) && m[1]!.toLowerCase() !== "init") vars.push({ name: m[2]!, at: address.get(m[2]!), note: `autodim ${m[1]}` });
    else if ((m = /^\s+incgraphic\s+(\S+)/i.exec(l))) {
      const name = m[1]!.replace(/\.png$/i, "");
      graphics.push(`  ${hex(address.get(name))}  ${m[1]}  (line ${i + 1})`);
    }
  });
  const byAddress = [...vars].sort((a, b) => (a.at ?? 1e9) - (b.at ?? 1e9));
  return `RUNTIME - what's in game.bas
============================

${symbols ? "Addresses come from the last build in Cartridge Studio; rebuild and they may move." : "Build the game to see addresses."}

Memory map (variables by address)
${byAddress.map((v) => `  ${hex(v.at)}  ${v.name.padEnd(16)} ${v.note}`).join("\n") || "  (none)"}

Constants
${consts.join("\n") || "  (none)"}

Labels (goto and gosub targets)
${labels.join("\n") || "  (none)"}

Graphics
${graphics.join("\n") || "  (none)"}
`;
}
