import { strFromU8, unzipSync } from "fflate";
import { encodeIndexedPng } from "@cartridge-studio/toolchain";
import { beforeAll, describe, expect, it } from "vitest";
import { buildProject } from "../build/project-build.ts";
import { readCartridgeFile, writeCartridgeFile } from "../files/cartridge-file.ts";
import { nodeBuilder } from "../harness/node.ts";
import { generateKit } from "../kit/generate.ts";
import { KIT_PRESETS } from "../kit/presets.ts";
import { SOUND_LIBRARY, TEMPLATES, getTemplate } from "../project/templates.ts";
import type { WasiBuilder } from "@cartridge-studio/toolchain";
import { parseBuildLog, romSpace } from "./build-log.ts";
import { blankCodeProject, ejectKit, ejectTemplate } from "./eject.ts";
import { markedLines } from "./markers.ts";
import { decodeIndexedPng } from "./png-decode.ts";
import { CodeProjectSchema, type CodeProject } from "./schema.ts";

const ghostPanic = () => structuredClone(KIT_PRESETS.find((p) => p.id === "ghost-panic")!.game);

let builder: WasiBuilder;
beforeAll(async () => {
  builder = await nodeBuilder();
});

describe("decodeIndexedPng", () => {
  it("reads back what encodeIndexedPng writes, odd widths too", () => {
    for (const rows of [["0123", "3210"], ["012", "333", "100"], ["1"]]) expect(decodeIndexedPng(encodeIndexedPng(rows))).toEqual(rows);
  });
});

describe("ejecting", () => {
  it("turns a kit game into a code project with the same game.bas and graphics", () => {
    const game = ghostPanic();
    const code = ejectKit(game, SOUND_LIBRARY);
    expect(CodeProjectSchema.safeParse(code).success).toBe(true);
    expect(code.title).toBe(game.title);
    const gen = generateKit(game, SOUND_LIBRARY);
    if (!gen.ok) throw new Error(gen.errors.join());
    expect(code.source).not.toContain("Do not edit");
    expect(code.source.split("\n").length).toBe(gen.input.source.split("\n").length);
    expect(code.graphics.map((g) => `${g.name}.png`).sort()).toEqual(Object.keys(gen.input.files).sort());
    // Each graphic keeps its thing's palette, so the asset editor shows its own colors.
    expect(code.graphics.find((g) => g.name === "spr0")!.palette).toBe(game.types[0]!.palette);
    expect(code.graphics.find((g) => g.name === "spr0")!.rows).toEqual(game.types[0]!.frames[0]);
  });

  it("builds the ejected kit game to the same ROM", async () => {
    const game = ghostPanic();
    const kit = await buildProject(builder, game, undefined, { sign: false });
    const code = await buildProject(builder, ejectKit(game, SOUND_LIBRARY), undefined, { sign: false });
    expect(kit.kind).toBe("built");
    expect(code.kind).toBe("built");
    if (kit.kind === "built" && code.kind === "built") expect(code.bin).toEqual(kit.bin);
  });

  it("ejects the classic shooter, and the blank project builds", async () => {
    const t = getTemplate("fixed-shooter");
    for (const p of [ejectTemplate(structuredClone(t.sample), t), blankCodeProject()]) {
      const r = await buildProject(builder, p, undefined, { sign: false });
      expect(r.kind, r.kind === "failed" ? r.log : "").toBe("built");
      if (r.kind === "built") expect(romSpace(r.log!).areas[0]!.bytes).toBeGreaterThan(0);
    }
  });

  it("reports a creator's mistake on its line", async () => {
    const p = blankCodeProject();
    const lines = p.source.split("\n");
    const at = lines.findIndex((l) => l.includes("drawscreen"));
    lines.splice(at, 0, " frobnicate 3");
    p.source = lines.join("\n");
    const r = await buildProject(builder, p, undefined, { sign: false });
    expect(r.kind).toBe("failed");
    if (r.kind === "failed") expect(parseBuildLog(r.log)).toEqual([expect.objectContaining({ line: at + 1, severity: "error" })]);
  });

  it("refuses broken graphics before the toolchain runs", async () => {
    const p = blankCodeProject();
    p.graphics[0]!.rows[1] = "0";
    expect((await buildProject(builder, p)).kind).toBe("invalid");
  });
});

describe("code project .cartridge files", () => {
  it("round-trip, with game.bas readable inside", () => {
    const p: CodeProject = ejectKit(ghostPanic(), SOUND_LIBRARY);
    const bytes = writeCartridgeFile(p);
    const files = unzipSync(bytes);
    expect(JSON.parse(strFromU8(files["cartridge.json"]!)).kind).toBe("code");
    expect(strFromU8(files["game.bas"]!)).toBe(p.source);
    expect(readCartridgeFile(bytes, TEMPLATES).result).toEqual({ ok: true, code: p });
  });

  it("refuses damaged code projects", () => {
    const p = blankCodeProject() as unknown as Record<string, unknown>;
    p.graphics = [{ name: "bad name!", rows: ["0"], palette: "ship" }];
    const r = readCartridgeFile(writeCartridgeFile(p as unknown as CodeProject), TEMPLATES).result;
    expect(r).toEqual({ ok: false, errors: ["This game file is damaged."] });
  });
});

describe("generated-code markers", () => {
  const game = ghostPanic();
  const gen = generateKit(game, SOUND_LIBRARY);
  if (!gen.ok) throw new Error("gen");
  const lines = gen.input.source.split("\n");
  const text = (r: { from: number; to: number }[]) => r.flatMap(({ from, to }) => lines.slice(from - 1, to));

  it("finds a rule's check and its actions", () => {
    const got = text(markedLines(gen.input.source, { rule: 2 }));
    expect(got[0]).toMatch(/^ rem rule 2: /);
    expect(got).toContain("r1_do");
    expect(got.some((l) => /^r0_|rem rule 3/.test(l))).toBe(false);
  });

  it("finds a thing's graphics, palette and draw routine", () => {
    const ghost = game.types.find((t) => t.frames.length > 1)!;
    const got = text(markedLines(gen.input.source, { thing: ghost.label, palette: ghost.palette }));
    expect(got).toContain(` rem ${ghost.label} frame 2`);
    expect(got).toContain(` rem palette ${ghost.palette}`);
    expect(got.some((l) => l.includes("plotsprite"))).toBe(true);
    expect(markedLines(gen.input.source, { thing: "Nobody" })).toEqual([]);
  });
});
