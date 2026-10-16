// The one package format (SPEC.md, "Exports"): everything a game leaves the
// editor with, in one ZIP, described by manifest.json. A submission package
// carries the print PDF and source too; a jam entry is the same package with
// a `jam` block. Only the ROM is required, so code projects and games built
// elsewhere can be packaged as well.

import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { z } from "zod";
import { slugify } from "./exports.ts";

export const PACKAGE_FORMAT = "cartridge-studio-package";
export const PACKAGE_VERSION = 1;
export const MANIFEST = "manifest.json";

const MTIME = new Date("2026-01-01T00:00:00Z");

/** Limits for reading packages someone else made. */
export const READ_LIMITS = { zipBytes: 16 * 1024 * 1024, fileBytes: 4 * 1024 * 1024, files: 400 } as const;

/** Licences a creator can choose, by SPDX id ("All rights reserved" has none, so it's ours). */
export const LICENCES = [
  { id: "LicenseRef-All-Rights-Reserved", name: "All rights reserved: people may play it, not copy or change it" },
  { id: "CC-BY-NC-4.0", name: "CC BY-NC 4.0: share and change it with credit, not for money" },
  { id: "CC-BY-4.0", name: "CC BY 4.0: share and change it with credit" },
  { id: "CC-BY-SA-4.0", name: "CC BY-SA 4.0: share and change it with credit, under the same licence" },
  { id: "CC0-1.0", name: "CC0: no rights reserved" },
  { id: "MIT", name: "MIT: the permissive software licence" },
  { id: "GPL-3.0-or-later", name: "GPL 3.0 or later: the copyleft software licence" },
] as const;
export type LicenceId = (typeof LICENCES)[number]["id"];
const LICENCE_IDS = LICENCES.map((l) => l.id) as [LicenceId, ...LicenceId[]];
export const licenceName = (id: string) => LICENCES.find((l) => l.id === id)?.name.split(":")[0] ?? id;

/** A path inside the package: lower-case names, no "..", no leading "/". */
const PathSchema = z
  .string()
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/, "Bad file path in manifest.json")
  .refine((p) => !p.split("/").includes(".."), "Bad file path in manifest.json");

export const ENTRY_LIMITS = { title: 80, credits: 200, description: 500, controls: 200 } as const;

export const JamBlockSchema = z.object({
  name: z.string().max(80),
  theme: z.string().max(120).default(""),
  /** The app build the brief pinned, if any. */
  pinnedApp: z.string().max(60).optional(),
  /** May the organizer put the game on a compilation (a multi-game cartridge or collection)? */
  compilation: z.boolean(),
  /** Where the game goes past the brief's limits, as the creator's app saw it. */
  flags: z.array(z.string().max(200)).max(20).default([]),
});
export type JamBlock = z.infer<typeof JamBlockSchema>;

export const ManifestSchema = z.object({
  format: z.literal(PACKAGE_FORMAT),
  version: z.number().int().min(1),
  title: z.string().trim().min(1).max(ENTRY_LIMITS.title),
  credits: z.string().trim().max(ENTRY_LIMITS.credits).default(""),
  description: z.string().trim().max(ENTRY_LIMITS.description).default(""),
  controls: z.string().trim().max(ENTRY_LIMITS.controls).default(""),
  licence: z.enum(LICENCE_IDS).optional(),
  build: z.object({
    builtAt: z.string().max(40),
    /** The Cartridge Studio build, e.g. "0.3.0+a9edf50"; "unknown" for ROMs made elsewhere. */
    app: z.string().max(60),
    /** The game kit runtime or template, e.g. "kit runtime 0.2.0". */
    runtime: z.string().max(60),
    toolchain: z.string().max(60),
    /** SHA-256 of the .a78, in hex: what judges and archives refer to. */
    romSha256: z.string().regex(/^[0-9a-f]{64}$/),
  }),
  files: z.object({
    a78: PathSchema,
    bin: PathSchema.optional(),
    player: PathSchema.optional(),
    cartridge: PathSchema.optional(),
    pdf: PathSchema.optional(),
    clip: PathSchema.optional(),
    thumbnail: PathSchema.optional(),
    source: PathSchema.optional(),
    readme: PathSchema.optional(),
  }),
  jam: JamBlockSchema.optional(),
});
export type Manifest = z.infer<typeof ManifestSchema>;

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface PackageInput {
  title: string;
  /** "submission" or "jam-entry": the folder is `<slug>-<kind>`. */
  kind: "submission" | "jam-entry";
  words?: { credits?: string; description?: string; controls?: string };
  licence?: LicenceId;
  build: { app: string; runtime: string; toolchain: string; builtAt?: string };
  /** CHECKLIST.txt or README.txt, by file name. */
  notes: { name: string; text: string };
  /** Signed ROMs. */
  a78: Uint8Array;
  bin?: Uint8Array;
  /** The offline player page. */
  player?: string;
  /** The .cartridge game file; its thumbnail becomes the package's when there isn't one. */
  cartridgeFile?: Uint8Array;
  pdf?: Uint8Array;
  clip?: Uint8Array | null;
  thumbnail?: Uint8Array;
  source?: Record<string, Uint8Array>;
  jam?: JamBlock;
}

function cartridgeThumbnail(cartridge: Uint8Array): Uint8Array | undefined {
  try {
    return unzipSync(cartridge, { filter: (f) => f.name === "thumbnail.png" && f.originalSize < READ_LIMITS.fileBytes })["thumbnail.png"];
  } catch {
    return undefined;
  }
}

const cut = (s: string | undefined, n: number) => (s ?? "").trim().slice(0, n);

/** Writes the package; also returns its manifest. */
export async function packageZip(i: PackageInput): Promise<{ zip: Uint8Array; manifest: Manifest; name: string }> {
  const title = cut(i.title, ENTRY_LIMITS.title) || "My game";
  const slug = slugify(title);
  const root = `${slug}-${i.kind}`;
  const thumbnail = i.thumbnail ?? (i.cartridgeFile && cartridgeThumbnail(i.cartridgeFile));
  const f: Manifest["files"] = { a78: `rom/${slug}.a78`, readme: i.notes.name };
  const files: Record<string, Uint8Array> = {
    [i.notes.name]: strToU8(i.notes.text),
    [f.a78]: i.a78,
  };
  const put = (key: keyof Manifest["files"], path: string, data: Uint8Array | undefined | null) => {
    if (!data) return;
    f[key] = path;
    files[path] = data;
  };
  put("bin", `rom/${slug}.bin`, i.bin);
  put("player", "play.html", i.player === undefined ? undefined : strToU8(i.player));
  put("cartridge", `project/${slug}.cartridge`, i.cartridgeFile);
  put("pdf", `print/${slug}-print.pdf`, i.pdf);
  put("clip", "media/clip.gif", i.clip);
  put("thumbnail", "media/thumbnail.png", thumbnail);
  if (i.source && Object.keys(i.source).length) {
    f.source = "source";
    for (const [name, data] of Object.entries(i.source)) files[`source/${name}`] = data;
  }
  const manifest: Manifest = ManifestSchema.parse({
    format: PACKAGE_FORMAT,
    version: PACKAGE_VERSION,
    title,
    credits: cut(i.words?.credits, ENTRY_LIMITS.credits),
    description: cut(i.words?.description, ENTRY_LIMITS.description),
    controls: cut(i.words?.controls, ENTRY_LIMITS.controls),
    ...(i.licence ? { licence: i.licence } : {}),
    build: {
      builtAt: i.build.builtAt ?? new Date().toISOString(),
      app: i.build.app,
      runtime: i.build.runtime,
      toolchain: i.build.toolchain,
      romSha256: await sha256Hex(i.a78),
    },
    files: f,
    ...(i.jam ? { jam: i.jam } : {}),
  });
  files[MANIFEST] = strToU8(`${JSON.stringify(manifest, null, 2)}\n`);
  const zip = zipSync(Object.fromEntries(Object.entries(files).map(([n, d]) => [`${root}/${n}`, d])), { level: 6, mtime: MTIME });
  return { zip, manifest, name: `${root}.zip` };
}

export interface ReadPackage {
  manifest: Manifest;
  files: {
    a78: Uint8Array;
    bin?: Uint8Array;
    cartridge?: Uint8Array;
    /** Checked to be a GIF. */
    clip?: Uint8Array;
    /** Checked to be a PNG. */
    thumbnail?: Uint8Array;
  };
}

export type ReadPackageResult = { ok: true; read: ReadPackage } | { ok: false; error: string };

const startsWith = (b: Uint8Array | undefined, sig: number[]) => !!b && sig.every((x, i) => b[i] === x);
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const GIF = [0x47, 0x49, 0x46, 0x38];

/**
 * Reads a package someone else made, e.g. a jam entry. The player page is never
 * read: whoever republishes the game makes a fresh one from the ROM.
 */
export async function readPackage(bytes: Uint8Array): Promise<ReadPackageResult> {
  if (bytes.length > READ_LIMITS.zipBytes) return { ok: false, error: "This file is too big to be a game package." };
  const names: string[] = [];
  let zip: Record<string, Uint8Array>;
  try {
    zip = unzipSync(bytes, {
      filter: (f) => {
        names.push(f.name);
        return names.length <= READ_LIMITS.files && f.originalSize <= READ_LIMITS.fileBytes && !f.name.endsWith(".html");
      },
    });
  } catch {
    return { ok: false, error: "This isn't a ZIP file." };
  }
  if (names.length > READ_LIMITS.files) return { ok: false, error: "This ZIP has too many files to be a game package." };
  const marker = Object.keys(zip)
    .filter((n) => (n === MANIFEST || n.endsWith(`/${MANIFEST}`)) && n.split("/").length <= 2)
    .sort((a, b) => a.length - b.length)[0];
  if (!marker) {
    return { ok: false, error: names.some((n) => n.endsWith("entry.json")) ? "This entry was made by an older Cartridge Studio; make it again." : "This ZIP isn't a game package: it has no manifest.json." };
  }
  const dir = marker.slice(0, -MANIFEST.length);
  let json: unknown;
  try {
    json = JSON.parse(strFromU8(zip[marker]!));
  } catch {
    return { ok: false, error: "This package's manifest.json is damaged." };
  }
  if ((json as { format?: unknown } | null)?.format !== PACKAGE_FORMAT) return { ok: false, error: "This ZIP isn't a Cartridge Studio game package." };
  const v = (json as { version?: unknown }).version;
  if (typeof v === "number" && v > PACKAGE_VERSION) return { ok: false, error: "This package was made by a newer version of Cartridge Studio." };
  const parsed = ManifestSchema.safeParse(json);
  if (!parsed.success) return { ok: false, error: `This package's manifest.json is damaged (${parsed.error.issues[0]?.message ?? "unknown"}).` };
  const manifest = parsed.data;
  const get = (p: string | undefined) => (p ? zip[dir + p] : undefined);
  const a78 = get(manifest.files.a78);
  if (!a78) return { ok: false, error: "This package has no ROM." };
  if (String.fromCharCode(...a78.subarray(1, 10)) !== "ATARI7800") return { ok: false, error: "This package's ROM isn't a 7800 ROM (.a78)." };
  if ((await sha256Hex(a78)) !== manifest.build.romSha256) return { ok: false, error: "This package's ROM doesn't match its manifest: it was changed after it was made." };
  const clip = get(manifest.files.clip);
  const thumbnail = get(manifest.files.thumbnail);
  return {
    ok: true,
    read: {
      manifest,
      files: {
        a78,
        bin: get(manifest.files.bin),
        cartridge: get(manifest.files.cartridge),
        clip: startsWith(clip, GIF) ? clip : undefined,
        thumbnail: startsWith(thumbnail, PNG) ? thumbnail : undefined,
      },
    },
  };
}
