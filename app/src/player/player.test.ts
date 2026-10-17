import { describe, expect, it } from "vitest";
import { jsonForScript, playerHtml, playerSharedFiles } from "./player.ts";

const core = "var a = 1;\nexport { a as B };";
const rom = new Uint8Array([1, 2, 3]);

/** The text of every script element, as an HTML parser would end them. */
const scripts = (html: string) => [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script/gi)].map((m) => m[1]!);

describe("the offline player", () => {
  it("keeps a hostile title inside its script and out of the markup", () => {
    const title = `</script><script>alert(1)</script><!--\u2028\u2029"'&<b>`;
    const html = playerHtml({ title, rom, core, license: "GPL </pre><script>x</script>" });
    // Only the page's own three scripts, with nothing injected.
    expect(scripts(html)).toHaveLength(3);
    expect(html).not.toContain("<script>alert(1)");
    expect(html).not.toContain("<b>");
    // The game data still reads back exactly.
    const game = scripts(html)[0]!;
    const w: { GAME?: { title: string; rom: string } } = {};
    new Function("window", game)(w);
    expect(w.GAME!.title).toBe(title);
    expect(w.GAME!.rom).toBe("AQID");
  });

  it("escapes what a script element can't hold", () => {
    expect(jsonForScript("</script>\u2028\u2029")).toBe('"\\u003c/script>\\u2028\\u2029"');
    expect(JSON.parse(jsonForScript({ a: "<!--" }))).toEqual({ a: "<!--" });
  });

  it("shares one core between linked pages", () => {
    const html = playerHtml({ title: "Linked", rom, shared: "../../player/", back: { href: "../../index.html", label: "All entries" } });
    expect(html).toContain('<script src="../../player/js7800-core.js"></script>');
    expect(html).toContain('<script src="../../player/runtime.js"></script>');
    expect(html).toContain('<a class="back" href="../../index.html">&larr; All entries</a>');
    expect(html).not.toContain(core);
    const files = playerSharedFiles({ core, license: "GPL" });
    expect(Object.keys(files)).toEqual(["js7800-core.js", "runtime.js", "LICENSE.txt"]);
    expect(files["js7800-core.js"]).toContain("window.JS7800 = { B: a }");
  });

  it("names the maker under the title, in the kit font with the words as typed, only when there is one", () => {
    const by = playerHtml({ title: "Ghost Panic", rom, core, license: "GPL", info: { controls: { move: "free", button: "fire" }, madeBy: "Sam & Robin" } });
    expect(by).toContain('<p class="by">');
    expect(by).toContain("by Sam &#38; Robin");
    const plain = playerHtml({ title: "Ghost Panic", rom, core, license: "GPL", info: { controls: { move: "free", button: "fire" }, madeBy: "Sam and Robin" } });
    expect(plain).toMatch(/<p class="by"><svg[^>]*>.*<\/svg><span class="sr-only">by Sam and Robin<\/span><\/p>/);
    expect(playerHtml({ title: "Ghost Panic", rom, core, license: "GPL" })).not.toContain('class="by"');
  });

  it("credits js7800, 7800basic and dasm in the footer", () => {
    const html = playerHtml({ title: "Ghost Panic", rom, core, license: "GPL" });
    expect(html).toMatch(/js7800<\/a> by raz0red/);
    expect(html).toMatch(/7800basic<\/a> by Mike Saarna \(RevEng\)/);
    expect(html).toContain(">dasm</a>");
  });

  it("links the studio only from an https public address", async () => {
    expect(playerHtml({ title: "G", rom, core, license: "GPL", home: "https://example.org/studio/" })).toContain('<a href="https://example.org/studio/" rel="noreferrer">Made with Cartridge Studio</a>');
    expect(playerHtml({ title: "G", rom, core, license: "GPL" })).not.toContain(">Made with Cartridge Studio</a>");
    const { appHome } = await import("./player.ts");
    const { PUBLIC_URL } = await import("../public-url.ts");
    expect(appHome()).toBe(PUBLIC_URL ? PUBLIC_URL : undefined);
  });
});
