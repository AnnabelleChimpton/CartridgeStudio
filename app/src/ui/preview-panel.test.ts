import { describe, expect, it } from "vitest";
import { failureDetails, failureHeadline } from "./PreviewPanel.tsx";

describe("failed build headlines", () => {
  it("name the stage that stopped", () => {
    expect(failureHeadline("worker")).toBe("The game builder stopped.");
    expect(failureHeadline("timeout")).toBe("The build took too long and was stopped.");
    expect(failureHeadline("7800basic")).toBe("The 7800basic compiler stopped.");
    expect(failureHeadline("dasm")).toBe("The dasm assembler stopped.");
    expect(failureHeadline("7800filter")).toBe("The 7800filter step of the build stopped.");
  });
});

describe("failed build details", () => {
  it("name the tool, the line and the message", () => {
    expect(failureDetails("7800basic", "7800basic failed", "*** ERROR line 12: unknown keyword")).toBe("Details: 7800basic, line 12: unknown keyword");
    expect(failureDetails("dasm", "dasm failed", "game.bas.asm (212): error: Branch out of range")).toMatch(/^Details: dasm: Branch out of range/);
    expect(failureDetails("worker", "The worker stopped", "")).toBe("Details: worker: The worker stopped");
    expect(failureDetails("worker", "", "")).toBe("Details");
  });
});
