// Fuzz (SPEC.md, "Test layers"): random valid projects must build and run for
// 600 frames without hanging, meaning the picture keeps changing. Seeded, so a
// failure can be replayed: FUZZ_SEED=<seed> FUZZ_COUNT=1 npx vitest run fuzz.
// Nightly runs set FUZZ_COUNT higher.

import { beforeAll, describe, expect, it } from "vitest";
import type { WasiBuilder } from "@cartridge-studio/toolchain";
import { generate } from "../codegen/generate.ts";
import type { CoreHost } from "../emulator/core-host.ts";
import type { Project, Template } from "../project/schema.ts";
import { NO_SOUND } from "../project/validate.ts";
import { TEMPLATES } from "../project/templates.ts";
import { nodeBuilder, nodeHost } from "./node.ts";

const COUNT = Number(process.env.FUZZ_COUNT ?? 6);
const SEED = Number(process.env.FUZZ_SEED ?? 20261016);

/** mulberry32: small, seedable PRNG. */
function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  const pick = <T,>(xs: readonly T[]): T => xs[int(xs.length)]!;
  return { next, int, pick };
}

export function randomProject(template: Template, seed: number): Project {
  const r = rng(seed);
  const m = template.manifest;
  const p = structuredClone(template.sample);
  for (const d of m.params) p.params[d.id] = d.min + r.int(Math.floor((d.max - d.min) / d.step) + 1) * d.step;
  for (const pal of p.palettes) pal.colors = [0, 1, 2].map(() => `$${r.int(256).toString(16).padStart(2, "0")}`) as never;
  for (const s of p.sprites) {
    if (!m.sprites.find((d) => d.role === s.role)!.editable) continue;
    s.frames = s.frames.map((f) => f.map((row) => Array.from(row, () => (r.next() < 0.4 ? "0" : String(1 + r.int(3)))).join("")));
  }
  p.rules = Array.from({ length: r.int(7) }, () => ({
    when: r.pick(m.triggers).id,
    then: Array.from({ length: 1 + r.int(3) }, () => r.pick(m.actions).id),
  }));
  for (const s of m.sounds) p.sounds[s.slot] = r.next() < 0.2 ? NO_SOUND : r.pick(template.soundLibrary).id;
  p.background.color = `$${r.int(256).toString(16).padStart(2, "0")}`;
  return p;
}

let builder: WasiBuilder;
let host: CoreHost;

beforeAll(async () => {
  builder = await nodeBuilder();
  host = await nodeHost();
});

for (const [id, template] of Object.entries(TEMPLATES)) {
  describe(`fuzz ${id}`, () => {
    for (let i = 0; i < COUNT; i++) {
      const seed = SEED + i;
      it(`seed ${seed} builds and keeps running for 600 frames`, async () => {
        const gen = generate(randomProject(template, seed), template);
        if (!gen.ok) throw new Error(`seed ${seed} made an invalid project: ${gen.errors.join("; ")}`);
        const built = await builder.build({ ...gen.input, sign: false });
        if (!built.ok) throw new Error(`seed ${seed} failed in ${built.stage}: ${built.message}`);
        await host.load(built.a78);

        const r = rng(seed);
        const pictures = new Set<string>();
        for (let f = 0; f < 600; f += 20) {
          host.setInput({ up: false, down: false, left: r.next() < 0.3, right: r.next() < 0.3, fire: r.next() < 0.5 });
          host.step(20);
          pictures.add(Buffer.from(host.indices()).toString("base64"));
        }
        // 30 samples over 10 seconds; a hung game would show one or two.
        expect(pictures.size, `seed ${seed}`).toBeGreaterThan(10);
      });
    }
  });
}
