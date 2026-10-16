import { strFromU8, unzipSync, zipSync } from "fflate";
import { beforeAll, describe, expect, it } from "vitest";
import type { WasiBuilder } from "@cartridge-studio/toolchain";
import type { CoreHost } from "../emulator/core-host.ts";
import type { Recording } from "../emulator/protocol.ts";
import { newRecording, noteFrames } from "../emulator/recording.ts";
import type { JoystickInput } from "../emulator/core-host.ts";
import { readCartridgeFile, writeCartridgeFile } from "../files/cartridge-file.ts";
import { kitSourceFiles } from "../files/exports.ts";
import { packageZip, readPackage } from "../files/package.ts";
import { nodeBuilder, nodeHost } from "../harness/node.ts";
import { KitGameSchema } from "../kit/schema.ts";
import { KIT_WATCH, buildKitRom } from "../kit/tests.ts";
import { SOUND_LIBRARY, TEMPLATES } from "../project/templates.ts";
import raw from "../../../templates/kit/games/ghost-panic.json";
import {
  MAX_TESTS,
  TestsFileSchema,
  addRecordedTest,
  describeTest,
  emptyTests,
  readTests,
  removeTest,
  runCreatorTests,
  stepsFromRecording,
  testFrames,
  testsBytes,
  testsJson,
  type Check,
} from "./creator-tests.ts";

const score: Check = { target: { name: "score", entry: KIT_WATCH.score! }, op: "gte", value: 10 };
/** Ghost Panic from power-on: wait, press fire to start, then hold right into the first yarn ball. */
const START: Recording = {
  frames: 5 + 2 + 2 + 60,
  runs: [
    { hold: [], frames: 5 },
    { hold: ["fire"], frames: 2 },
    { hold: [], frames: 2 },
    { hold: ["right"], frames: 60 },
  ],
};

describe("recording a check", () => {
  it("turns runs of held controls into behaviour steps, ending in the expectation", () => {
    expect(stepsFromRecording(START)).toEqual([{ frames: 5 }, { hold: ["fire"], frames: 2 }, { frames: 2 }, { hold: ["right"], frames: 60 }]);
    const file = addRecordedTest(emptyTests(), "  Eats the yarn ", START, score);
    expect(file.tests).toHaveLength(1);
    expect(file.tests[0]!.name).toBe("Eats the yarn");
    expect(file.tests[0]!.steps.at(-1)).toEqual({ expect: { score: { gte: 10 } } });
    expect(file.watch).toEqual({ score: { symbol: "score0", bytes: 3, bcd: true } });
    expect(describeTest(file.tests[0]!)).toBe("score is at least 10");
    expect(testFrames(file.tests[0]!.steps)).toBe(69);
  });

  it("names a test when it's left blank, and checks any symbol under its own name", () => {
    const sym: Check = { target: { name: "levelnum", entry: { symbol: "levelnum" } }, op: "eq", value: 1 };
    const file = addRecordedTest(addRecordedTest(emptyTests(), "", START, score), "", START, sym);
    expect(file.tests.map((t) => t.name)).toEqual(["Check 1", "Check 2"]);
    expect(describeTest(file.tests[1]!)).toBe("levelnum is 1");
    expect(file.watch.levelnum).toEqual({ symbol: "levelnum" });
  });

  it("doesn't let two variables share a name", () => {
    const other: Check = { target: { name: "score", entry: { symbol: "score2" } }, op: "ne", value: 0 };
    const file = addRecordedTest(addRecordedTest(emptyTests(), "a", START, score), "b", START, other);
    expect(Object.keys(file.watch)).toEqual(["score", "score_2"]);
    expect(file.tests[1]!.steps.at(-1)).toEqual({ expect: { score_2: { ne: 0 } } });
  });

  it("removing a test drops the variables only it used", () => {
    const sym: Check = { target: { name: "lives", entry: { symbol: "lives" } }, op: "eq", value: 3 };
    const file = addRecordedTest(addRecordedTest(emptyTests(), "a", START, score), "b", START, sym);
    const left = removeTest(file, 0);
    expect(left.tests.map((t) => t.name)).toEqual(["b"]);
    expect(Object.keys(left.watch)).toEqual(["lives"]);
  });

  it("keeps to its limits", () => {
    let file = emptyTests();
    for (let i = 0; i < MAX_TESTS; i++) file = addRecordedTest(file, "", START, score);
    expect(() => addRecordedTest(file, "", START, score)).toThrow(/at most 50/);
    expect(() => addRecordedTest(emptyTests(), "", { frames: 40_000, runs: [{ hold: [], frames: 40_000 }] }, score)).toThrow(/ten minutes/);
    const busy: Recording = { frames: 3000, runs: Array.from({ length: 3000 }, (_, i) => ({ hold: i % 2 ? ["left" as const] : [], frames: 1 })) };
    expect(() => addRecordedTest(emptyTests(), "", busy, score)).toThrow(/too often/);
  });
});

describe("tests.json", () => {
  it("round-trips, and refuses anything that isn't one", () => {
    const file = addRecordedTest(emptyTests(), "Eats the yarn", START, score);
    expect(readTests(JSON.parse(testsJson(file)))).toEqual(file);
    expect(TestsFileSchema.safeParse(file).success).toBe(true);
    expect(readTests({ ...file, format: "something-else" })).toBeNull();
    expect(readTests({ ...file, version: 2 })).toBeNull();
    expect(readTests({ ...file, watch: { "x y": { symbol: "x" } } })).toBeNull();
    expect(readTests({ ...file, tests: [{ name: "t", steps: [{ frames: -1 }] }] })).toBeNull();
    expect(readTests(null)).toBeNull();
    expect(testsBytes(emptyTests())).toBeUndefined();
    expect(strFromU8(testsBytes(file)!)).toBe(testsJson(file));
  });

  it("rides along in the cartridge file, and a damaged one doesn't stop the game opening", () => {
    const game = KitGameSchema.parse(raw);
    const file = addRecordedTest(emptyTests(), "Eats the yarn", START, score);
    const bytes = writeCartridgeFile(game, undefined, file);
    expect(Object.keys(unzipSync(bytes))).toContain("tests.json");
    const opened = readCartridgeFile(bytes, TEMPLATES);
    expect(opened.result.ok).toBe(true);
    expect(opened.tests).toEqual(file);
    expect(Object.keys(unzipSync(writeCartridgeFile(game, undefined, emptyTests())))).not.toContain("tests.json");

    const zip = unzipSync(bytes);
    zip["tests.json"] = new TextEncoder().encode("{ not json");
    const damaged = readCartridgeFile(zipSync(zip), TEMPLATES);
    expect(damaged.result.ok).toBe(true);
    expect(damaged.tests).toBeUndefined();
  });
});

describe("exports", () => {
  const file = addRecordedTest(emptyTests(), "Eats the yarn", START, score);

  it("the source folder has tests.json, and its README says what it is", () => {
    const files = kitSourceFiles(KitGameSchema.parse(raw), SOUND_LIBRARY, { tests: testsBytes(file) });
    expect(strFromU8(files["tests.json"]!)).toBe(testsJson(file));
    expect(strFromU8(files["README.txt"]!)).toMatch(/tests\.json +your checks/);
    expect(kitSourceFiles(KitGameSchema.parse(raw), SOUND_LIBRARY)["tests.json"]).toBeUndefined();
  });

  it("the package (and so a jam entry) carries tests.json, named in its manifest", async () => {
    const a78 = new Uint8Array(256);
    a78.set(new TextEncoder().encode("ATARI7800"), 1);
    const { zip, manifest } = await packageZip({
      title: "Ghost Panic",
      kind: "jam-entry",
      build: { app: "test", runtime: "kit", toolchain: "7800basic" },
      notes: { name: "README.txt", text: "" },
      a78,
      tests: testsBytes(file),
    });
    expect(manifest.files.tests).toBe("tests.json");
    expect(strFromU8(unzipSync(zip)["ghost-panic-jam-entry/tests.json"]!)).toBe(testsJson(file));
    const read = await readPackage(zip);
    expect(read.ok).toBe(true);
  });
});

describe("running creator tests on a headless core", () => {
  let builder: WasiBuilder;
  let host: CoreHost;
  beforeAll(async () => {
    builder = await nodeBuilder();
    host = await nodeHost();
  });

  it("passes on Ghost Panic, and fails with the frame once the yarn is gone", async () => {
    const game = KitGameSchema.parse(raw);
    const file = addRecordedTest(emptyTests(), "Eats the yarn", START, score);
    const rom = await buildKitRom(game, SOUND_LIBRARY, builder);
    if (!rom.ok) throw new Error(rom.failure);
    expect(await runCreatorTests(host, rom.a78, rom.symbols, file)).toEqual([{ name: "Eats the yarn", passed: true, frames: 69 }]);

    // Break it: the yarn ball next to the cat is gone.
    const broken = structuredClone(game);
    broken.room.rows[1] = broken.room.rows[1]!.replace("P  y", "P   ");
    const brokenRom = await buildKitRom(broken, SOUND_LIBRARY, builder);
    if (!brokenRom.ok) throw new Error(brokenRom.failure);
    const [r] = await runCreatorTests(host, brokenRom.a78, brokenRom.symbols, file);
    expect(r).toMatchObject({ name: "Eats the yarn", passed: false, frames: 69 });
    expect(r!.failure).toMatch(/score is 0/);
  }, 60_000);

  it("a recording made while playing replays to the same moment", async () => {
    // Play as the emulator worker does: a frame at a time, noting the controls held for each.
    const rom = await buildKitRom(KitGameSchema.parse(raw), SOUND_LIBRARY, builder);
    if (!rom.ok) throw new Error(rom.failure);
    await host.load(rom.a78);
    const rec = newRecording();
    const idle: JoystickInput = { up: false, down: false, left: false, right: false, fire: false };
    const plan: [Partial<JoystickInput>, number][] = [[{}, 5], [{ fire: true }, 2], [{}, 3], [{ right: true }, 40], [{ down: true }, 30], [{ down: true, fire: true }, 4], [{ left: true }, 25]];
    for (const [press, n] of plan) {
      const held = { ...idle, ...press };
      host.setInput(held);
      for (let i = 0; i < n; i++) {
        noteFrames(rec, held, 1);
        host.step(1);
      }
    }
    const symbols = new Map(rom.symbols.split("\n").map((l) => l.split(/\s+/)).filter((p) => /^[0-9a-f]{4}$/.test(p[1] ?? "")).map((p) => [p[0]!, parseInt(p[1]!, 16)]));
    const live = { x: host.readMemory(symbols.get("ox")!, 24), score: host.readMemory(symbols.get("score0")!, 3), loops: host.readMemory(symbols.get("loopslo")!, 2) };
    expect(rec.frames).toBe(109);
    expect(rec.runs.map((r) => r.hold)).toEqual([[], ["fire"], [], ["right"], ["down"], ["down", "fire"], ["left"]]);

    // The recorded test, checking the hero's x where it ended up, passes on a fresh run.
    const heroX: Check = { target: { name: "heroX", entry: KIT_WATCH.heroX! }, op: "eq", value: live.x[0]! };
    const file = addRecordedTest(emptyTests(), "Ends up there", rec, heroX);
    expect(await runCreatorTests(host, rom.a78, rom.symbols, file)).toEqual([{ name: "Ends up there", passed: true, frames: 109 }]);
    expect(host.readMemory(symbols.get("ox")!, 24)).toEqual(live.x);
    expect(host.readMemory(symbols.get("score0")!, 3)).toEqual(live.score);
    expect(host.readMemory(symbols.get("loopslo")!, 2)).toEqual(live.loops);
  }, 60_000);
});
