// Headless emulator harness: the js7800 core runs in Node, stepped frame by
// frame, against ROMs built from projects. This is the base for template
// behaviour tests (SPEC.md, "Test layers").

import { beforeAll, describe, expect, it } from "vitest";
import type { WasiBuilder } from "@cartridge-studio/toolchain";
import { generate } from "../codegen/generate.ts";
import { nodeBuilder, nodeHost } from "../harness/node.ts";
import type { Project } from "../project/schema.ts";
import { getTemplate } from "../project/templates.ts";
import { parseSymbols, type CoreHost, type JoystickInput } from "./core-host.ts";

const template = getTemplate("fixed-shooter");
const IDLE: JoystickInput = { up: false, down: false, left: false, right: false, fire: false };

let builder: WasiBuilder;
let host: CoreHost;

beforeAll(async () => {
  builder = await nodeBuilder();
  host = await nodeHost();
});

async function buildRom(mutate: (p: Project) => void = () => {}) {
  const project = structuredClone(template.sample);
  mutate(project);
  const gen = generate(project, template);
  if (!gen.ok) throw new Error(gen.errors.join("\n"));
  const r = await builder.build({ ...gen.input, sign: false });
  if (!r.ok) throw new Error(`${r.stage}: ${r.message}`);
  return { rom: r.a78, symbols: parseSymbols(r.symbols) };
}

/** Taps fire every 12 frames for `taps` taps. */
function tapFire(taps: number) {
  for (let i = 0; i < taps; i++) {
    host.setInput({ ...IDLE, fire: true });
    host.step(2);
    host.setInput(IDLE);
    host.step(10);
  }
}

const bcd = (bytes: Uint8Array) => Number([...bytes].map((b) => b.toString(16).padStart(2, "0")).join(""));

describe("CoreHost", () => {
  it("runs a built ROM and draws the game", async () => {
    const { rom } = await buildRom();
    await host.load(rom);
    host.step(60);
    const lit = host.indices().filter((v) => v !== 0).length;
    expect(lit).toBeGreaterThan(1000); // HUD, formation and ship
    expect(host.frame).toBe(60);
  });

  it("is deterministic in lockstep", async () => {
    const { rom } = await buildRom();
    const run = async () => {
      await host.load(rom);
      tapFire(20);
      return Buffer.from(host.indices()).toString("base64");
    };
    expect(await run()).toBe(await run());
  });

  it("reads game variables from RAM via dasm's symbols", async () => {
    const { rom, symbols } = await buildRom((p) => (p.params.lives = 5));
    await host.load(rom);
    host.step(5);
    expect(host.readMemory(symbols.get("lives")!)[0]).toBe(5);
    expect(bcd(host.readMemory(symbols.get("score0")!, 3))).toBe(0);
  });

  it("scores when shots hit (scripted input, read back from RAM)", async () => {
    const { rom, symbols } = await buildRom((p) => (p.params.pointsPerEnemy = 30));
    await host.load(rom);
    tapFire(25);
    const score = bcd(host.readMemory(symbols.get("score0")!, 3));
    expect(score).toBeGreaterThan(0);
    expect(score % 30).toBe(0);
  });

  it("plays the shoot sound effect when firing", async () => {
    const variance = (xs: Float32Array) => {
      const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
      return xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
    };
    const fireAndListen = async (shootSound: string) => {
      const { rom } = await buildRom((p) => {
        p.params.bombRate = 0;
        p.sounds = { shoot: shootSound, hit: "none", lose: "none", wave: "none" };
      });
      await host.load(rom);
      host.step(5);
      tapFire(1); // start the game
      host.step(30);
      host.takeSamples();
      host.step(10);
      const quiet = variance(host.takeSamples());
      host.setInput({ ...IDLE, fire: true });
      host.step(2);
      host.setInput(IDLE);
      host.step(6);
      return { quiet, firing: variance(host.takeSamples()) };
    };
    const withSound = await fireAndListen("zap");
    expect(withSound.quiet).toBeLessThan(1e-6);
    expect(withSound.firing).toBeGreaterThan(1e-4);
    const silent = await fireAndListen("none");
    expect(silent.firing).toBeLessThan(1e-6);
  });

  it("produces sound samples every frame", async () => {
    const { rom } = await buildRom();
    await host.load(rom);
    host.takeSamples();
    host.step(60);
    const samples = host.takeSamples();
    expect(samples.length).toBeGreaterThan(60 * 400);
  });
});
