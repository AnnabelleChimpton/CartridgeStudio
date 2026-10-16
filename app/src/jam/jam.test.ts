import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { writeCartridgeFile } from "../files/cartridge-file.ts";
import { encodeRgbaPng } from "../files/png.ts";
import { KIT_PRESETS } from "../kit/presets.ts";
import {
  CLASSIC_PRESET,
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
import { entryZip, readEntryZip, type EntryInput } from "./entry.ts";
import { galleryEntries, galleryIndexHtml, galleryZip, withBackLink } from "./gallery.ts";
import { EMPTY_WORDS } from "./store.ts";

const brief = newBrief({
  name: "Spooky Cartridge Jam",
  theme: "It's behind you",
  dates: "Fri 31 Oct to Sun 2 Nov",
  constraints: ["One room", "Two colours"],
  presets: ["maze", "ghost-panic"],
  link: "https://itch.io/jam/spooky-cartridge",
});

describe("jam briefs", () => {
  it("fills in defaults and round-trips as a file", () => {
    const b = newBrief({ name: "Tiny" });
    expect(b).toEqual({ format: JAM_FORMAT, version: 1, name: "Tiny", theme: "", dates: "", constraints: [], presets: [] });
    expect(readBriefText(briefFileText(brief))).toEqual({ ok: true, brief });
  });

  it("round-trips through a compact, URL-safe link", () => {
    const param = encodeBriefParam(brief);
    expect(param).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeBriefParam(param)).toEqual({ ok: true, brief });
    const unicode = newBrief({ name: "Jäm ☃", theme: "Élan — vital" });
    expect(decodeBriefParam(encodeBriefParam(unicode))).toEqual({ ok: true, brief: unicode });
    // Defaults are left out of the link.
    expect(Buffer.from(encodeBriefParam(newBrief({ name: "A" })), "base64url").toString("utf8")).toBe(
      '{"format":"cartridge-studio-jam","version":1,"name":"A"}',
    );
  });

  it("makes a link to the app that carries only the jam", () => {
    const url = new URL(briefLink(brief, "https://example.org/studio/?builder=inline#x"));
    expect(url.pathname).toBe("/studio/");
    expect([...url.searchParams.keys()]).toEqual(["jam"]);
    expect(decodeBriefParam(url.searchParams.get("jam")!)).toEqual({ ok: true, brief });
  });

  it("refuses what isn't a brief, newer versions and bad links", () => {
    expect(parseBrief({ name: "x" })).toEqual({ ok: false, errors: ["This isn't a Cartridge Studio jam brief."] });
    expect(parseBrief({ format: JAM_FORMAT, version: 2, name: "x" })).toMatchObject({ ok: false, errors: [expect.stringMatching(/newer version/)] });
    expect(parseBrief({ format: JAM_FORMAT, version: 1, name: "" })).toMatchObject({ ok: false });
    expect(parseBrief({ format: JAM_FORMAT, version: 1, name: "x", link: "javascript:alert(1)" })).toMatchObject({ ok: false });
    expect(parseBrief({ format: JAM_FORMAT, version: 1, name: "x", constraints: Array(9).fill("r") })).toMatchObject({ ok: false });
    expect(decodeBriefParam("%%%")).toMatchObject({ ok: false });
    expect(decodeBriefParam("e30")).toMatchObject({ ok: false }); // {}
    expect(readBriefText("{")).toEqual({ ok: false, errors: ["This jam brief is damaged."] });
  });

  it("offers the brief's starting games that exist, else all of them", () => {
    const all = [...KIT_PRESETS.map((p) => p.id), CLASSIC_PRESET];
    expect(offeredPresets(null, all)).toEqual(all);
    expect(offeredPresets(brief, all)).toEqual(all.filter((id) => id === "maze" || id === "ghost-panic"));
    expect(offeredPresets(newBrief({ name: "x", presets: ["nope"] }), all)).toEqual(all);
    expect(offeredPresets(newBrief({ name: "x", presets: [CLASSIC_PRESET] }), all)).toEqual([CLASSIC_PRESET]);
  });
});

const PLAYER = "<!doctype html>\n<html><head><title>x</title></head>\n<body>\n<h1>x</h1>\n</body></html>\n";
const GIF = strToU8("GIF89a-not-really");

function input(over: Partial<EntryInput> = {}): EntryInput {
  const game = structuredClone(KIT_PRESETS[0]!.game);
  return {
    brief,
    words: { ...EMPTY_WORDS, credits: "Sam and Robin", description: "Ghosts. <Run>.", controls: "Arrows move" },
    gameTitle: "Haunt & Seek",
    playerHtml: PLAYER,
    cartridge: writeCartridgeFile(game, encodeRgbaPng(2, 2, new Uint8Array(16).fill(200))),
    a78: new Uint8Array([1, 2, 3]),
    bin: new Uint8Array([4, 5]),
    ...over,
  };
}

describe("jam entries", () => {
  it("packs the player, game file, signed ROMs, clip, thumbnail and entry.json in one folder", () => {
    const zip = unzipSync(entryZip({ ...input(), clip: GIF }));
    expect(Object.keys(zip).sort()).toEqual(
      [
        "README.txt",
        "clip.gif",
        "entry.json",
        "haunt-seek.a78",
        "haunt-seek.bin",
        "haunt-seek.cartridge",
        "play.html",
        "thumbnail.png",
      ].map((f) => `haunt-seek-jam-entry/${f}`),
    );
    const entry = JSON.parse(strFromU8(zip["haunt-seek-jam-entry/entry.json"]!));
    expect(entry).toMatchObject({
      format: "cartridge-studio-jam-entry",
      version: 1,
      jam: { name: "Spooky Cartridge Jam", theme: "It's behind you" },
      title: "Haunt & Seek",
      credits: "Sam and Robin",
      files: { player: "play.html", clip: "clip.gif", thumbnail: "thumbnail.png", a78: "haunt-seek.a78" },
    });
    expect(strFromU8(zip["haunt-seek-jam-entry/README.txt"]!)).toContain("Not affiliated with or endorsed by Atari");
  });

  it("uses the creator's title over the game's, and leaves out a missing clip", () => {
    const zip = unzipSync(entryZip(input({ words: { ...EMPTY_WORDS, title: "  Boo!  " } })));
    expect(Object.keys(zip)).toContain("boo-jam-entry/entry.json");
    expect(Object.keys(zip)).not.toContain("boo-jam-entry/clip.gif");
    expect(JSON.parse(strFromU8(zip["boo-jam-entry/entry.json"]!)).title).toBe("Boo!");
  });

  it("reads back what it writes, with or without the folder", () => {
    const bytes = entryZip({ ...input(), clip: GIF });
    const r = readEntryZip(bytes);
    if (!r.ok) throw new Error(r.error);
    expect(r.read.entry.title).toBe("Haunt & Seek");
    expect([...r.read.files.a78]).toEqual([1, 2, 3]);
    expect(r.read.files.clip).toEqual(GIF);
    expect(r.read.files.thumbnail?.subarray(1, 4)).toEqual(strToU8("PNG"));

    const flat = zipSync(Object.fromEntries(Object.entries(unzipSync(bytes)).map(([n, d]) => [n.split("/").pop()!, d])));
    expect(readEntryZip(flat)).toMatchObject({ ok: true });
  });

  it("explains broken entries", () => {
    expect(readEntryZip(strToU8("nope"))).toEqual({ ok: false, error: "This isn't a ZIP file." });
    expect(readEntryZip(zipSync({ "a.txt": strToU8("x") }))).toMatchObject({ ok: false, error: expect.stringMatching(/no entry.json/) });
    const files = unzipSync(entryZip(input()));
    delete files["haunt-seek-jam-entry/haunt-seek.bin"];
    expect(readEntryZip(zipSync(files))).toEqual({ ok: false, error: "This entry is missing files: bin." });
    const evil = unzipSync(entryZip(input()));
    const json = JSON.parse(strFromU8(evil["haunt-seek-jam-entry/entry.json"]!));
    json.files.player = "../../etc/passwd";
    evil["haunt-seek-jam-entry/entry.json"] = strToU8(JSON.stringify(json));
    expect(readEntryZip(zipSync(evil))).toMatchObject({ ok: false, error: expect.stringMatching(/damaged/) });
  });
});

describe("jam galleries", () => {
  const read = (over: Partial<EntryInput> = {}) => {
    const r = readEntryZip(entryZip(input(over)));
    if (!r.ok) throw new Error(r.error);
    return r.read;
  };

  it("gives entries folders in title order, without clashes", () => {
    const list = galleryEntries([
      read({ gameTitle: "Zap" }),
      read({ gameTitle: "apple" }),
      read({ gameTitle: "Zap" }),
    ]);
    expect(list.map((e) => e.slug)).toEqual(["apple", "zap", "zap-2"]);
  });

  it("builds a static site: index.html at the top and each entry's player and files", () => {
    const zip = unzipSync(galleryZip({ name: brief.name, theme: brief.theme }, [read({ clip: GIF }), read({ gameTitle: "Second", cartridge: writeCartridgeFile(structuredClone(KIT_PRESETS[1]!.game)) })]));
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
      "entries/second/second.cartridge",
      "index.html",
    ]);
    expect(strFromU8(zip["entries/second/play.html"]!)).toContain('href="../../index.html"');
  });

  it("writes an accessible index with escaped text and no outside requests", () => {
    const html = galleryIndexHtml(
      { name: "Jam <1>", theme: "Up & down", dates: "This weekend", constraints: ["One room"], link: "https://example.org/jam" },
      galleryEntries([read({ clip: GIF }), read({ gameTitle: "Plain", words: { ...EMPTY_WORDS }, cartridge: writeCartridgeFile(structuredClone(KIT_PRESETS[1]!.game)) })]),
    );
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("<h1>Jam &#60;1&#62;</h1>");
    expect(html).toContain("Ghosts. &#60;Run&#62;.");
    expect(html).toContain('alt="Screenshot of Haunt &#38; Seek"');
    expect(html).toContain('href="entries/haunt-seek/play.html"');
    expect(html).toContain('data-clip="entries/haunt-seek/clip.gif"');
    expect(html).toContain("Not affiliated with or endorsed by Atari");
    expect(html.match(/<h2 /g)).toHaveLength(2);
    // Only relative links, plus the organizer's own page.
    const urls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]!);
    expect(urls.filter((u) => /^[a-z]+:/i.test(u) && !u.startsWith("data:"))).toEqual(["https://example.org/jam"]);
  });

  it("adds the way back only once, inside the body", () => {
    expect(withBackLink(PLAYER).match(/All entries/g)).toHaveLength(1);
    expect(withBackLink(PLAYER).indexOf("All entries")).toBeGreaterThan(PLAYER.indexOf("<body>"));
  });

  it("needs at least one entry", () => {
    expect(() => galleryZip({ name: "x" }, [])).toThrow(/at least one/);
  });
});
