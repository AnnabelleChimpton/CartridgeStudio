import { describe, expect, it } from "vitest";
import { KIT_PRESETS } from "./presets.ts";
import type { KitRule } from "./schema.ts";
import { ruleSentence } from "./sentence.ts";

/** "is is", "the the": a word said twice in a row. */
const doubled = (s: string) => /\b(\w+) \1\b/i.exec(s)?.[0];

describe("rule sentences", () => {
  for (const p of KIT_PRESETS) {
    it(`${p.id}: read as sentences, with no word twice in a row`, async () => {
      const sentences = p.game.rules.map((r) => ruleSentence(r, p.game));
      for (const s of sentences) expect(doubled(s), s).toBeUndefined();
      await expect(sentences.join("\n") + "\n").toMatchFileSnapshot(`./__snapshots__/${p.id}.rules.txt`);
    });
  }

  it("say how a rule fires only when that isn't the trigger's usual way", () => {
    const g = KIT_PRESETS.find((p) => p.id === "ghost-panic")!.game;
    const [a, b] = g.types.map((t) => t.id) as [string, string];
    const name = (id: string) => g.types.find((t) => t.id === id)!.label;
    const touch = (fires?: "once" | "while"): KitRule => ({ id: "r", when: { touch: [a, b] }, ...(fires && { fires }), then: [{ id: "x", destroy: "other" }] });
    expect(ruleSentence(touch(), g)).toBe(`When ${name(a)} touches ${name(b)}, remove the ${name(b)}.`);
    expect(ruleSentence(touch("while"), g)).toBe(`When ${name(a)} touches ${name(b)}, remove the ${name(b)}.`);
    expect(ruleSentence(touch("once"), g)).toBe(`When ${name(a)} touches ${name(b)} the first time, remove the ${name(b)}.`);
    const edge = (fires?: "once" | "while"): KitRule => ({ id: "r", when: { edge: [b, "bottom"] }, ...(fires && { fires }), then: [{ id: "x", restartRoom: true }] });
    expect(ruleSentence(edge(), g)).toBe(`When a ${name(b)} reaches the bottom edge, start the room again.`);
    expect(ruleSentence(edge("while"), g)).toBe(`When a ${name(b)} reaches the bottom edge the whole time, start the room again.`);
  });
});
