import { describe, expect, it } from "vitest";
import { failureHeadline } from "./PreviewPanel.tsx";

describe("failed build headlines", () => {
  it("name the stage that stopped", () => {
    expect(failureHeadline("worker")).toBe("The game builder stopped.");
    expect(failureHeadline("timeout")).toBe("The build took too long and was stopped.");
    expect(failureHeadline("7800basic")).toBe("The 7800basic compiler stopped.");
    expect(failureHeadline("dasm")).toBe("The dasm assembler stopped.");
    expect(failureHeadline("7800filter")).toBe("The 7800filter step of the build stopped.");
  });

  it("follow the voice rules", () => {
    for (const s of ["worker", "internal", "timeout", "toolchain", "7800basic", "dasm", "x"]) {
      expect(failureHeadline(s)).not.toMatch(/!|—|went wrong/);
    }
  });
});
