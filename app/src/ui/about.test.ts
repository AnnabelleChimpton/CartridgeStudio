import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import lock from "../../../toolchain/toolchain.lock.json" with { type: "json" };
import { CREDITS, js7800Commit } from "./about.ts";

const readme = fs.readFileSync(path.resolve(import.meta.dirname, "../../public/vendor/js7800-core/README.md"), "utf8");

describe("About and licences", () => {
  it("takes versions from the pinned files", () => {
    const commit = js7800Commit(readme);
    const byName = Object.fromEntries(CREDITS.map((c) => [c.name, c]));
    expect(byName["7800basic"]!.version).toBe(lock.version);
    expect(byName["7800basic"]!.source).toBe(`https://github.com/7800-devtools/7800basic/tree/v${lock.version}`);
    expect(byName["js7800"]!.source).toBe(`https://github.com/raz0red/js7800/tree/${commit}`);
    expect(byName["js7800"]!.note).toBe("Built from upstream source at this commit with two worker-safe I/O stand-ins (app/js7800-core/, app/scripts/build-js7800.mjs), then minified.");
    expect(byName["dasm"]!.source).toBe("https://github.com/dasm-assembler/dasm");
  });

  it("refuses a README without a commit", () => {
    expect(() => js7800Commit("# js7800")).toThrow(/commit/);
  });
});
