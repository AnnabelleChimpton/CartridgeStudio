import { strFromU8, strToU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { writeCartridgeFile } from "../files/cartridge-file.ts";
import { readPackage, type ReadPackage } from "../files/package.ts";
import { encodeRgbaPng } from "../files/png.ts";
import { KIT_PRESETS } from "../kit/presets.ts";
import {
  JAM_FORMAT,
  briefFileText,
  briefLink,
  decodeBriefParam,
  encodeBriefParam,
  newBrief,
  offeredPresets,
  parseBrief,
  readBriefText,
} from "./brief.ts";
import { entryFlags, entryProblem, jamEntryZip, organizerFlags, type EntryInput } from "./entry.ts";
import { galleryEntries, galleryIndexHtml, galleryZip, judgesCsv, parseCsv, resultsHtml, tallyResults, type GalleryEntry } from "./gallery.ts";
import { cartridgeFacts, checkLimits, kitFacts } from "./limits.ts";
import { EMPTY_WORDS } from "./store.ts";

const brief = newBrief({
  name: "Spooky Cartridge Jam",
  theme: "It's behind you",
  dates: "Fri 31 Oct to Sun 2 Nov",
  constraints: ["One room", "Two colours"],
  presets: ["maze", "ghost-panic"],
  criteria: ["Fun", "Theme"],
  limits: { maxRules: 4, maxRomKB: 1024 },
  app: "1.0.0+abc",
  link: "https://itch.io/jam/spooky-cartridge",
});

const toBase64 = (b: Uint8Array) => Buffer.from(b).toString("base64");

describe("jam briefs", () => {
  it("fills in defaults and round-trips as a file", () => {
    const b = newBrief({ name: "Tiny" });
    expect(b).toEqual({ format: JAM_FORMAT, version: 1, name: "Tiny", theme: "", dates: "", constraints: [], presets: [], starters: [], criteria: [], limits: {} });
    expect(readBriefText(briefFileText(brief))).toEqual({ ok: true, brief });
  });

  it("round-trips through a compact, URL-safe link, starter games and all", () => {
    const param = encodeBriefParam(brief);
    expect(param).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeBriefParam(param)).toEqual({ ok: true, brief });
    const unicode = newBrief({ name: "Jäm ☃", theme: "Élan — vital" });
    expect(decodeBriefParam(encodeBriefParam(unicode))).toEqual({ ok: true, brief: unicode });
    expect(Buffer.from(encodeBriefParam(newBrief({ name: "A" })), "base64url").toString("utf8")).toBe('{"format":"cartridge-studio-jam","version":1,"name":"A"}');
    const withStarter = newBrief({ name: "S", starters: [{ name: "Haunt", cartridge: toBase64(writeCartridgeFile(KIT_PRESETS[0]!.game)) }] });
    const back = decodeBriefParam(encodeBriefParam(withStarter));
    expect(back).toEqual({ ok: true, brief: withStarter });
  });

  it("makes a link to the app that carries only the jam", () => {
    const url = new URL(briefLink(brief, "https://example.org/studio/?builder=inline#x"));
    expect(url.pathname).toBe("/studio/");
    expect([...url.searchParams.keys()]).toEqual(["jam"]);
    expect(decodeBriefParam(url.searchParams.get("jam")!)).toEqual({ ok: true, brief });
  });

  it("refuses what isn't a brief, newer versions, bad links and oversized parts", () => {
    expect(parseBrief({ name: "x" })).toEqual({ ok: false, errors: ["This isn't a Cartridge Studio jam brief."] });
    expect(parseBrief({ format: JAM_FORMAT, version: 2, name: "x" })).toMatchObject({ ok: false, errors: [expect.stringMatching(/newer version/)] });
    expect(parseBrief({ format: JAM_FORMAT, version: 1, name: "" })).toMatchObject({ ok: false });
    expect(parseBrief({ format: JAM_FORMAT, version: 1, name: "x", link: "javascript:alert(1)" })).toMatchObject({ ok: false });
    expect(parseBrief({ format: JAM_FORMAT, version: 1, name: "x", constraints: Array(9).fill("r") })).toMatchObject({ ok: false });
    expect(parseBrief({ format: JAM_FORMAT, version: 1, name: "x", limits: { maxRules: 0 } })).toMatchObject({ ok: false });
    expect(parseBrief({ format: JAM_FORMAT, version: 1, name: "x", limits: { maxBananas: 3 } })).toMatchObject({ ok: false });
    expect(parseBrief({ format: JAM_FORMAT, version: 1, name: "x", starters: [{ name: "a", cartridge: "x".repeat(400_000) }] })).toMatchObject({ ok: false });
    expect(parseBrief({ format: JAM_FORMAT, version: 1, name: "x", starters: [{ name: "a", cartridge: "<script>" }] })).toMatchObject({ ok: false });
    expect(decodeBriefParam("%%%")).toMatchObject({ ok: false });
    expect(decodeBriefParam("e30")).toMatchObject({ ok: false }); // {}
    expect(readBriefText("{")).toEqual({ ok: false, errors: ["This jam brief is damaged."] });
  });

  it("offers the brief's built-in starting games that exist, else all of them", () => {
    const all = KIT_PRESETS.map((p) => p.id);
    expect(offeredPresets(null, all)).toEqual(all);
    expect(offeredPresets(brief, all)).toEqual(all.filter((id) => id === "maze" || id === "ghost-panic"));
    // Old briefs could name the Classic shooter; it's retired, so they get the kit's starters.
    expect(all).not.toContain("fixed-shooter");
    expect(offeredPresets(newBrief({ name: "x", presets: ["fixed-shooter"] }), all)).toEqual(all);
  });
});

describe("jam limits", () => {
  it("flags what goes past a limit, and only that", () => {
    expect(checkLimits({ maxRules: 4, maxTypes: 8, maxRomKB: 32 }, { rules: 5, types: 8, romBytes: 48 * 1024 })).toEqual([
      "Rules: 5, over the limit of 4.",
      "ROM size in KB: 48, over the limit of 32.",
    ]);
    expect(checkLimits({ maxRules: 4 }, {})).toEqual([]);
  });

  it("reads a kit game's facts from its game file", () => {
    const game = KIT_PRESETS.find((p) => p.id === "ghost-panic")!.game;
    expect(cartridgeFacts(writeCartridgeFile(game))).toEqual(kitFacts(game));
    expect(cartridgeFacts(strToU8("nope"))).toBeNull();
  });
});

function fakeA78(seed = 1): Uint8Array {
  const rom = new Uint8Array(256).fill(seed);
  rom.set([1, ...strToU8("ATARI7800")], 0);
  return rom;
}

const ghostPanic = KIT_PRESETS.find((p) => p.id === "ghost-panic")!.game;

function input(over: Partial<EntryInput> = {}): EntryInput {
  return {
    brief,
    words: { ...EMPTY_WORDS, credits: "Sam and Robin", description: "Ghosts. <Run>.", controls: "Arrows move", licence: "CC-BY-4.0", compilation: true },
    gameTitle: "Haunt & Seek",
    build: { app: "1.0.0+abc", runtime: "kit runtime 0.2.0", toolchain: "7800basic 0.41", builtAt: "2026-10-31T12:00:00.000Z" },
    facts: kitFacts(ghostPanic),
    player: "<!doctype html><title>creator's own page</title><script>steal()</script>",
    cartridge: writeCartridgeFile(ghostPanic, encodeRgbaPng(2, 2, new Uint8Array(16).fill(200))),
    a78: fakeA78(),
    bin: new Uint8Array([4, 5]),
    ...over,
  };
}

async function read(over: Partial<EntryInput> = {}): Promise<ReadPackage> {
  const r = await readPackage((await jamEntryZip(input(over))).zip);
  if (!r.ok) throw new Error(r.error);
  return r.read;
}

describe("jam entries", () => {
  it("are the one package format with a jam block", async () => {
    const { zip, manifest, name } = await jamEntryZip({ ...input(), clip: strToU8("GIF89a") });
    expect(name).toBe("haunt-seek-jam-entry.zip");
    expect(Object.keys(unzipSync(zip)).sort()).toEqual(
      [
        "README.txt",
        "manifest.json",
        "media/clip.gif",
        "media/thumbnail.png",
        "play.html",
        "project/haunt-seek.cartridge",
        "rom/haunt-seek.a78",
        "rom/haunt-seek.bin",
      ].map((f) => `haunt-seek-jam-entry/${f}`),
    );
    expect(manifest).toMatchObject({
      title: "Haunt & Seek",
      credits: "Sam and Robin",
      licence: "CC-BY-4.0",
      build: { app: "1.0.0+abc", runtime: "kit runtime 0.2.0", builtAt: "2026-10-31T12:00:00.000Z", romSha256: expect.stringMatching(/^[0-9a-f]{64}$/) },
      jam: { name: "Spooky Cartridge Jam", theme: "It's behind you", pinnedApp: "1.0.0+abc", compilation: true, flags: [`Rules: ${ghostPanic.rules.length}, over the limit of 4.`] },
    });
    const readme = strFromU8(unzipSync(zip)["haunt-seek-jam-entry/README.txt"]!);
    expect(readme).toContain("Haunt & Seek - entry for Spooky Cartridge Jam");
    expect(readme).toContain("Not affiliated with or endorsed by Atari");
  });

  it("need a licence", async () => {
    expect(entryProblem({ ...EMPTY_WORDS })).toMatch(/licence/);
    await expect(jamEntryZip(input({ words: { ...EMPTY_WORDS } }))).rejects.toThrow(/licence/);
  });

  it("flag a build other than the pinned one", () => {
    expect(entryFlags(brief, {}, "1.0.0+abc")).toEqual([]);
    expect(entryFlags(brief, {}, "1.1.0+def")).toEqual(["Made with Cartridge Studio 1.1.0+def; the jam uses 1.0.0+abc."]);
  });

  it("are checked by the organizer without trusting their own flags", async () => {
    const r = await read({ build: { ...input().build, app: "2.0.0+zzz" }, facts: {} });
    expect(r.manifest.jam?.flags).toEqual(["Made with Cartridge Studio 2.0.0+zzz; the jam uses 1.0.0+abc."]);
    expect(organizerFlags(r, brief)).toEqual([
      "Made with Cartridge Studio 2.0.0+zzz; the jam uses 1.0.0+abc.",
      `Rules: ${ghostPanic.rules.length}, over the limit of 4.`,
    ]);
    const byo = await read({ cartridge: undefined });
    expect(organizerFlags(byo, brief)).toEqual(["No kit game file, so only the ROM size could be checked."]);
    expect(organizerFlags(byo, { name: "Other Jam" })).toEqual(["Made for another jam: Spooky Cartridge Jam."]);
  });
});

const ASSETS = { core: "var a = 1;\nexport { a as B };", license: "GPL" };

describe("jam galleries", () => {
  const entry = async (over: Partial<EntryInput> = {}): Promise<GalleryEntry> => ({ read: await read(over), flags: [] });

  it("gives entries folders in title order, without clashes", async () => {
    const list = galleryEntries([await entry({ gameTitle: "Zap" }), await entry({ gameTitle: "apple" }), await entry({ gameTitle: "Zap" })]);
    expect(list.map((e) => e.slug)).toEqual(["apple", "zap", "zap-2"]);
  });

  it("makes every player afresh from the ROM, sharing one core", async () => {
    const zip = unzipSync(galleryZip({ name: brief.name }, [await entry({ clip: strToU8("GIF89a") }), await entry({ gameTitle: "Second", cartridge: undefined })], ASSETS));
    expect(Object.keys(zip).sort()).toEqual([
      "entries/haunt-seek/clip.gif",
      "entries/haunt-seek/haunt-seek.a78",
      "entries/haunt-seek/haunt-seek.bin",
      "entries/haunt-seek/haunt-seek.cartridge",
      "entries/haunt-seek/play.html",
      "entries/haunt-seek/thumbnail.png",
      "entries/second/play.html",
      "entries/second/second.a78",
      "entries/second/second.bin",
      "index.html",
      "player/LICENSE.txt",
      "player/js7800-core.js",
      "player/runtime.js",
    ]);
    const play = strFromU8(zip["entries/haunt-seek/play.html"]!);
    expect(play).not.toContain("steal()");
    expect(play).toContain('<script src="../../player/js7800-core.js"></script>');
    expect(play).toContain('href="../../index.html"');
  });

  it("leaves out who made what in an anonymous gallery", async () => {
    const zip = unzipSync(galleryZip({ name: "J" }, [await entry()], ASSETS, { anonymous: true }));
    expect(Object.keys(zip).filter((n) => n.endsWith(".cartridge") || n.endsWith(".bin"))).toEqual([]);
    expect(strFromU8(zip["index.html"]!)).not.toContain("Sam and Robin");
  });

  it("writes an accessible index with escaped text and no outside requests", async () => {
    const html = galleryIndexHtml(
      { name: "Jam <1>", theme: "Up & down", dates: "This weekend", constraints: ["One room"], link: "https://example.org/jam" },
      galleryEntries([await entry({ clip: strToU8("GIF89a") }), await entry({ gameTitle: "Plain", words: { ...EMPTY_WORDS, licence: "CC0-1.0" }, cartridge: undefined })]),
    );
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("<h1>Jam &#60;1&#62;</h1>");
    expect(html).toContain("Ghosts. &#60;Run&#62;.");
    expect(html).toContain("By Sam and Robin");
    expect(html).toContain("Licence: CC BY 4.0");
    expect(html).toContain('alt="Screenshot of Haunt &#38; Seek"');
    expect(html).toContain('data-clip="entries/haunt-seek/clip.gif"');
    expect(html).toContain("Not affiliated with or endorsed by Atari");
    expect(html.match(/<h2 /g)).toHaveLength(2);
    const urls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]!);
    expect(urls.filter((u) => /^[a-z]+:/i.test(u) && !u.startsWith("data:"))).toEqual(["https://example.org/jam"]);
  });

  it("needs at least one entry", () => {
    expect(() => galleryZip({ name: "x" }, [], ASSETS)).toThrow(/at least one/);
  });
});

describe("judging", () => {
  it("writes a judges' sheet with a column per criterion, safe for spreadsheets", async () => {
    const entries = [{ read: await read({ words: { ...input().words, credits: "=HYPERLINK(evil)" } }), flags: ["Rules: 9, over the limit of 4."] }];
    const csv = judgesCsv({ name: "J", criteria: ["Fun", "Theme"] }, entries);
    const rows = parseCsv(csv);
    expect(rows[0]).toEqual(["id", "title", "credits", "play", "licence", "compilation", "flags", "app", "rom_sha256", "Fun", "Theme", "notes"]);
    expect(rows[1]!.slice(0, 7)).toEqual(["haunt-seek", "Haunt & Seek", "'=HYPERLINK(evil)", "entries/haunt-seek/play.html", "CC BY 4.0", "yes", "Rules: 9, over the limit of 4."]);
    expect(parseCsv(judgesCsv({ name: "J" }, entries, { anonymous: true }))[0]).not.toContain("credits");
  });

  it("averages filled-in sheets into results", async () => {
    const entries = [{ read: await read(), flags: [] }, { read: await read({ gameTitle: "Second" }), flags: [] }];
    const info = { name: "J", criteria: ["Fun", "Theme"] };
    const sheet = (rows: string[][]) => [["id", "title", "Fun", "Theme"], ...rows].map((r) => r.join(",")).join("\n");
    const r = tallyResults(info, entries, [
      { name: "a.csv", text: sheet([["haunt-seek", "x", "4", "5"], ["second", "x", "3", "3"]]) },
      { name: "b.csv", text: sheet([["haunt-seek", "x", "2", "5"], ["second", "x", "5", "5"], ["nobody", "x", "1", "1"]]) },
      { name: "c.csv", text: "id;Fun;Theme\nsecond;4,5;" },
      { name: "notes.csv", text: "just,some,notes" },
    ]);
    expect(r.rows.map((x) => [x.slug, x.scores, x.overall, x.judges])).toEqual([
      ["second", [12.5 / 3, 4], (12.5 / 3 + 4) / 2, 3],
      ["haunt-seek", [3, 5], 4, 2],
    ]);
    expect(r.problems).toEqual(['b.csv: there\'s no entry "nobody".', 'notes.csv: no "id" column, so it isn\'t a judges\' sheet.']);
    const html = resultsHtml(info, r);
    expect(html).toContain('<th scope="col">Fun</th>');
    expect(html).toContain('<a href="entries/second/play.html">Second</a>');
    expect(html.indexOf("Second")).toBeLessThan(html.indexOf("Haunt &#38; Seek"));
  });
});
