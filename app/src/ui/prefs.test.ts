import { describe, expect, it } from "vitest";
import { TIERS, readTier } from "./prefs.ts";

describe("tiers", () => {
  it("are named by what you touch", () => {
    expect(TIERS.map((t) => t.label)).toEqual(["Kit", "Rules", "7800basic"]);
  });

  it("read the old stored names as the new ones", () => {
    expect(readTier("starter")).toBe("kit");
    expect(readTier("maker")).toBe("rules");
    expect(readTier("coder")).toBe("7800basic");
  });

  it("keep current names and drop anything else", () => {
    for (const t of TIERS) expect(readTier(t.id)).toBe(t.id);
    expect(readTier(null)).toBeNull();
    expect(readTier("toString")).toBeNull();
    expect(readTier("expert")).toBeNull();
  });

  it("describe themselves in the voice rules", () => {
    for (const t of TIERS) expect(t.detail).not.toMatch(/!|—|drawer/);
  });
});
