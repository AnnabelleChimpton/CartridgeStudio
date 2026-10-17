import { describe, expect, it } from "vitest";
import { KIT_PRESETS } from "./presets.ts";
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
});
