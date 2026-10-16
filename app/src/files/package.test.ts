import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { getTemplate } from "../project/templates.ts";
import { writeCartridgeFile } from "./cartridge-file.ts";
import { checklist, sourceFiles } from "./exports.ts";
import { READ_LIMITS, packageZip, readPackage, sha256Hex, type PackageInput } from "./package.ts";
import { encodeRgbaPng } from "./png.ts";

const template = getTemplate("fixed-shooter");

/** Enough of an .a78 to pass the header check. */
function fakeA78(seed = 1): Uint8Array {
  const rom = new Uint8Array(256).fill(seed);
  rom.set([1, ...strToU8("ATARI7800")], 0);
  return rom;
}

function submission(over: Partial<PackageInput> = {}): PackageInput {
  const p = structuredClone(template.sample);
  return {
    kind: "submission",
    title: p.title,
    notes: { name: "CHECKLIST.txt", text: checklist(p, template) },
    build: { app: "0.0.0+test", runtime: "fixed-shooter template 1", toolchain: "7800basic 0.41", builtAt: "2026-10-16T00:00:00.000Z" },
    source: sourceFiles(p, template),
    a78: fakeA78(),
    bin: new Uint8Array([2]),
    pdf: strToU8("%PDF-"),
    cartridgeFile: writeCartridgeFile(p, encodeRgbaPng(2, 2, new Uint8Array(16))),
    player: "<!doctype html><title>x</title>",
    ...over,
  };
}

describe("packages", () => {
  it("packs ROMs, PDF, game file, source, player, thumbnail and a manifest", async () => {
    const { zip, manifest, name } = await packageZip(submission({ clip: strToU8("GIF89a") }));
    expect(name).toBe("cat-vs-vacuums-submission.zip");
    const names = Object.keys(unzipSync(zip)).map((n) => n.replace("cat-vs-vacuums-submission/", ""));
    expect(names).toEqual(
      expect.arrayContaining([
        "CHECKLIST.txt",
        "manifest.json",
        "play.html",
        "rom/cat-vs-vacuums.bin",
        "rom/cat-vs-vacuums.a78",
        "print/cat-vs-vacuums-print.pdf",
        "project/cat-vs-vacuums.cartridge",
        "source/game.bas",
        "source/enemy_1.png",
        "media/clip.gif",
        "media/thumbnail.png",
      ]),
    );
    expect(manifest).toMatchObject({
      format: "cartridge-studio-package",
      title: "Cat vs. Vacuums",
      build: { app: "0.0.0+test", romSha256: await sha256Hex(fakeA78()) },
      files: { a78: "rom/cat-vs-vacuums.a78", source: "source", readme: "CHECKLIST.txt" },
    });
    expect(manifest.jam).toBeUndefined();
    expect(JSON.parse(strFromU8(unzipSync(zip)["cat-vs-vacuums-submission/manifest.json"]!))).toEqual(manifest);
  });

  it("needs only a ROM, so games made elsewhere can be packaged", async () => {
    const { zip } = await packageZip({
      kind: "jam-entry",
      title: "Bring Your Own",
      notes: { name: "README.txt", text: "hi" },
      build: { app: "unknown", runtime: "unknown", toolchain: "unknown" },
      a78: fakeA78(7),
    });
    const r = await readPackage(zip);
    if (!r.ok) throw new Error(r.error);
    expect(r.read.files.cartridge).toBeUndefined();
    expect(r.read.manifest.files).toEqual({ a78: "rom/bring-your-own.a78", readme: "README.txt" });
  });

  it("reads back what it writes, but never the player page", async () => {
    const r = await readPackage((await packageZip(submission({ clip: strToU8("GIF89a") }))).zip);
    if (!r.ok) throw new Error(r.error);
    expect(r.read.files.a78).toEqual(fakeA78());
    expect(r.read.files.clip).toEqual(strToU8("GIF89a"));
    expect(r.read.files.thumbnail?.subarray(1, 4)).toEqual(strToU8("PNG"));
    expect(Object.keys(r.read.files)).not.toContain("player");
  });

  it("drops media that isn't what it claims", async () => {
    const r = await readPackage((await packageZip(submission({ clip: strToU8("<script>"), thumbnail: strToU8("<svg onload=x>") }))).zip);
    if (!r.ok) throw new Error(r.error);
    expect(r.read.files.clip).toBeUndefined();
    expect(r.read.files.thumbnail).toBeUndefined();
  });

  it("refuses broken, tampered and oversized packages", async () => {
    expect(await readPackage(strToU8("nope"))).toEqual({ ok: false, error: "This isn't a ZIP file." });
    expect(await readPackage(zipSync({ "a.txt": strToU8("x") }))).toMatchObject({ ok: false, error: expect.stringMatching(/no manifest.json/) });
    expect(await readPackage(zipSync({ "x/entry.json": strToU8("{}") }))).toMatchObject({ ok: false, error: expect.stringMatching(/older Cartridge Studio/) });

    const files = unzipSync((await packageZip(submission())).zip);
    const root = "cat-vs-vacuums-submission/";
    const tampered = { ...files, [`${root}rom/cat-vs-vacuums.a78`]: fakeA78(9) };
    expect(await readPackage(zipSync(tampered))).toMatchObject({ ok: false, error: expect.stringMatching(/doesn't match its manifest/) });

    const notRom = { ...files, [`${root}rom/cat-vs-vacuums.a78`]: new Uint8Array(256) };
    expect(await readPackage(zipSync(notRom))).toMatchObject({ ok: false, error: expect.stringMatching(/isn't a 7800 ROM/) });

    const manifest = JSON.parse(strFromU8(files[`${root}manifest.json`]!));
    manifest.files.a78 = "../../etc/passwd";
    expect(await readPackage(zipSync({ ...files, [`${root}manifest.json`]: strToU8(JSON.stringify(manifest)) }))).toMatchObject({
      ok: false,
      error: expect.stringMatching(/damaged/),
    });
    const newer = { ...JSON.parse(strFromU8(files[`${root}manifest.json`]!)), version: 99 };
    expect(await readPackage(zipSync({ ...files, [`${root}manifest.json`]: strToU8(JSON.stringify(newer)) }))).toMatchObject({
      ok: false,
      error: expect.stringMatching(/newer version/),
    });

    expect(await readPackage(new Uint8Array(READ_LIMITS.zipBytes + 1))).toMatchObject({ ok: false, error: expect.stringMatching(/too big/) });
    const many = Object.fromEntries(Array.from({ length: READ_LIMITS.files + 1 }, (_, i) => [`f${i}.txt`, strToU8("x")]));
    expect(await readPackage(zipSync(many))).toMatchObject({ ok: false, error: expect.stringMatching(/too many files/) });
  });
});
