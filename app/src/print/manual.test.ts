import { describe, expect, it } from "vitest";
import { getTemplate } from "../project/templates.ts";
import { draftManual, manualText, parseManual } from "./manual.ts";

const template = getTemplate("fixed-shooter");

describe("draftManual", () => {
  it("drafts the sample's manual from its rules and settings", () => {
    expect(draftManual(template.sample, template)).toMatchInlineSnapshot(`
      "# How to play
      A formation of enemies is marching down the screen. Move along the bottom and shoot them all before they reach you.

      # Controls
      - Press the button to start.
      - Push the joystick left and right to move.
      - Press the button to fire. One shot can be on screen at a time.

      # Rules
      - When the player is hit, lose a life.
      - When fire is pressed, player shoots.
      - When a shot hits an enemy, add points.
      - When all enemies are cleared, start the next wave.

      # Good to know
      - You start with 3 lives.
      - Each enemy you hit is worth 10 points.
      - Every new wave is a little faster than the last.
      - Watch out for falling bombs!

      When your last life is gone, the game ends. Press the button to play again.
      "
    `);
  });

  it("follows the settings and leaves out facts that don't apply", () => {
    const p = structuredClone(template.sample);
    p.params.lives = 5;
    p.params.waveSpeedup = 0;
    p.params.bombRate = 0;
    p.rules = [{ when: "shot.hits.enemy", then: ["score.add", "lives.lose", "wave.next"] }];
    const text = draftManual(p, template);
    expect(text).toContain("- You start with 5 lives.");
    expect(text).not.toContain("faster");
    expect(text).not.toContain("bombs");
    expect(text).toContain("- When a shot hits an enemy, add points, lose a life and start the next wave.");
  });

  it("prefers the creator's edited text", () => {
    const p = structuredClone(template.sample);
    expect(manualText(p, template)).toBe(draftManual(p, template));
    p.cartridge.manualText = "# Story\nThe vacuums are back.";
    expect(manualText(p, template)).toBe("# Story\nThe vacuums are back.");
  });
});

describe("parseManual", () => {
  it("reads headings, bullets and paragraphs", () => {
    expect(parseManual("# Story\nLine one\nline two\n\n- a\n- b\n\nEnd")).toEqual([
      { kind: "heading", text: "Story" },
      { kind: "paragraph", text: "Line one line two" },
      { kind: "bullet", text: "a" },
      { kind: "bullet", text: "b" },
      { kind: "paragraph", text: "End" },
    ]);
  });
});
