import { describe, expect, it } from "vitest";
import { buildStats, parseBuildLog, romSpace } from "./build-log.ts";

// Excerpts of real 7800basic 0.41 and dasm output (through 7800filter).
const BASIC_ERROR = `$ 7800preprocess 
$ 7800basic -i /7800basic -b game.bas -p game.bas.pre
7800basic v0.41 Jul 11 2026 13:25:13
*** ERROR  line 64: unknown keyword 'frobnicate'.
`;
const DASM_ERROR = `$ 7800filter 

   stack allowance: 30 nested subroutines.
   17201 bytes of ROM space left in the main area.
     2337 bytes left in the 7800basic reserved area.

game.bas.asm (1955): error: Unknown Mnemonic 'jmp .nowhere_label'.
    The likely source is line 64 in your basic source code:
      goto nowhere_label

Fatal assembly error: Source is not resolvable.
`;
const UNTRACED = `$ 7800filter 
7800basic_variable_redefs.h (237): error: Syntax Error ''.
7800basic_variable_redefs.h (237): error: Syntax Error ''.

Unrecoverable error(s) in pass, aborting assembly!
Complete. (5)
`;
const OK = `*** INFO  GFX Block #0 starts @ $E000
        spr0 spr1 font
*** INFO  GFX block #0 has 1552 bytes left (194 x 8 bytes)
*** WARNING  line 12: the sprite is wider than it needs to be.
7800basic compilation complete.
   17204 bytes of ROM space left in the main area.
Complete. (0)
`;

describe("build log parsing", () => {
  it("maps 7800basic errors to their line", () => {
    expect(parseBuildLog(BASIC_ERROR)).toEqual([{ severity: "error", line: 64, message: "unknown keyword 'frobnicate'", tool: "7800basic" }]);
  });

  it("maps dasm errors back to the basic line 7800filter names", () => {
    expect(parseBuildLog(DASM_ERROR)).toEqual([
      { severity: "error", line: 64, message: "Unknown Mnemonic 'nowhere_label' (no such label?)", tool: "dasm" },
    ]);
  });

  it("keeps errors it can't place, once each", () => {
    expect(parseBuildLog(UNTRACED)).toEqual([
      { severity: "error", message: "Syntax Error '' (in 7800basic_variable_redefs.h, line 237)", tool: "dasm" },
    ]);
    expect(parseBuildLog("Fatal assembly error: Source is not resolvable.\n")).toEqual([
      { severity: "error", message: "Fatal assembly error: Source is not resolvable", tool: "dasm" },
    ]);
  });

  it("reads warnings and preprocessor errors", () => {
    expect(parseBuildLog(OK)).toEqual([{ severity: "warning", line: 12, message: "the sprite is wider than it needs to be", tool: "7800basic" }]);
    expect(parseBuildLog("(7) ERROR: Malformed define statement. Empty define name.")[0]).toMatchObject({ line: 7, severity: "error" });
    expect(parseBuildLog("######## ERROR: space overflow detected in 1 areas.")[0]).toMatchObject({ message: "space overflow detected in 1 areas" });
  });

  it("reads the ROM space left", () => {
    expect(romSpace(OK)).toEqual({ areas: [{ name: "the main area", bytes: 17204 }], graphics: [{ block: 0, bytes: 1552 }] });
    expect(romSpace("   -12 bytes of ROM space left in the main area.").areas[0]!.bytes).toBe(-12);
  });

  it("reads the zone, stack and reserved-area figures", () => {
    expect(buildStats(`${DASM_ERROR}\n     $1880 to $1fff used as zone memory, allowing 15 display objects per zone.\n`)).toEqual({
      areas: [{ name: "the main area", bytes: 17201 }],
      graphics: [],
      stackDepth: 30,
      zoneObjects: 15,
      reservedLeft: 2337,
    });
  });
});
