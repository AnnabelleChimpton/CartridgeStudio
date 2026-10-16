// Snapshots of what every preset compiles to: its IR (without the pixels)
// and its 7800basic. A change to generated code shows up here in review.
// Update them with: npx vitest run src/kit/snapshots.test.ts -u

import { describe, expect, it } from "vitest";
import { SOUND_LIBRARY } from "../project/templates.ts";
import { generateKit } from "./generate.ts";
import { KIT_PRESETS } from "./presets.ts";

describe("preset snapshots", () => {
  for (const p of KIT_PRESETS) {
    it(`${p.id}: IR and game.bas`, async () => {
      const gen = generateKit(p.game, SOUND_LIBRARY);
      if (!gen.ok) throw new Error(gen.errors.join("\n"));
      const ir = JSON.stringify(gen.ir, (k, v) => (k === "frames" ? `${v.length} frame(s)` : v), 1);
      await expect(ir).toMatchFileSnapshot(`./__snapshots__/${p.id}.ir.json`);
      await expect(gen.input.source).toMatchFileSnapshot(`./__snapshots__/${p.id}.bas`);
      // Every rule and thing maps to lines (coder mode's rule-to-code view).
      for (const r of p.game.rules) expect(gen.spans.some((s) => s.kind === "rule" && s.id === r.id), r.id).toBe(true);
      for (const t of p.game.types) expect(gen.spans.some((s) => s.kind === "type" && s.id === t.id), t.id).toBe(true);
    });
  }
});
