import { describe, expect, it } from "vitest";
import { BOOT_REPORT_URL, COMPAT, bootReport } from "./boot.ts";
import { firstBootCardHtml } from "./first-boot.ts";

describe("boot reports", () => {
  it("name the game, the ROM and the build, and leave blanks for the console", () => {
    const r = bootReport({
      title: "Ghost Panic",
      app: "0.3.0+abc1234",
      toolchain: "7800basic 0.41",
      file: { name: "ghost-panic.a78", bytes: 32896, sha256: "ab".repeat(32) },
      answer: "no",
    });
    expect(r).toContain("Game: Ghost Panic");
    expect(r).toContain("ROM file: ghost-panic.a78, 32,896 bytes");
    expect(r).toContain(`ROM SHA-256: ${"ab".repeat(32)}`);
    expect(r).toContain("Made with: Cartridge Studio 0.3.0+abc1234, 7800basic 0.41");
    expect(r).toMatch(/^Console \(7800, 7800\+, 2600\+\):$/m);
    expect(r).toMatch(/What happened .*: It didn't boot$/m);
  });

  it("work before any download", () => {
    const r = bootReport({ title: "", app: "dev" });
    expect(r).toContain("Game: Untitled");
    expect(r).toContain("ROM file: not downloaded yet");
    expect(r).not.toContain("SHA-256");
  });

  it("go to the issue form, never in the link", () => {
    const url = new URL(BOOT_REPORT_URL);
    expect(url.host).toBe("github.com");
    expect([...url.searchParams.keys()]).toEqual(["template"]);
    expect(url.searchParams.get("template")).toBe("boot-report.yml");
  });
});

describe("the compatibility table", () => {
  it("starts untested", () => {
    expect(COMPAT.note).toBe("Not yet tested on hardware.");
    expect(COMPAT.rows).toEqual([]);
  });
});

describe("the First boot card", () => {
  it("prints the title, file and date, escaped", () => {
    const html = firstBootCardHtml({ title: "Cats & <Vacuums>", file: "cats.a78", date: "16/10/2026" });
    expect(html).toContain("<h1>First boot</h1>");
    expect(html).toContain("Cats &#38; &#60;Vacuums&#62;");
    expect(html).not.toContain("<Vacuums>");
    expect(html).toContain("cats.a78");
    expect(html).not.toMatch(/!(?!doctype)/i);
  });
});
