// Jam entries: one ZIP a creator sends the organizer. Everything in it is
// static: a player page that runs offline, the game file, signed ROMs, an
// optional clip and thumbnail, and entry.json, which the gallery builder reads.

import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { z } from "zod";
import { slugify } from "../files/exports.ts";
import { CARTRIDGE_EXTENSION } from "../files/cartridge-file.ts";
import type { JamBrief } from "./brief.ts";
import type { EntryWords } from "./store.ts";

export const ENTRY_FORMAT = "cartridge-studio-jam-entry";
export const ENTRY_VERSION = 1;

const MTIME = new Date("2026-01-01T00:00:00Z");

/** A file name inside the entry's folder: no folders, no tricks. */
const fileName = z.string().regex(/^[a-z0-9][a-z0-9._-]{0,120}$/, "Bad file name in entry.json");

export const EntrySchema = z.object({
  format: z.literal(ENTRY_FORMAT),
  version: z.number().int().min(1),
  jam: z.object({ name: z.string().max(80), theme: z.string().max(120).default("") }),
  title: z.string().trim().min(1).max(80),
  credits: z.string().trim().max(200).default(""),
  description: z.string().trim().max(500).default(""),
  controls: z.string().trim().max(200).default(""),
  files: z.object({
    player: fileName,
    cartridge: fileName,
    a78: fileName,
    bin: fileName,
    clip: fileName.optional(),
    thumbnail: fileName.optional(),
  }),
  madeWith: z.string().max(80).default("Cartridge Studio"),
});

export type Entry = z.infer<typeof EntrySchema>;

export const ENTRY_LIMITS = { title: 80, credits: 200, description: 500, controls: 200 } as const;

export interface EntryInput {
  brief: JamBrief;
  words: EntryWords;
  /** The game's own title, used when the words leave it empty. */
  gameTitle: string;
  /** From buildPlayerHtml. */
  playerHtml: string;
  /** The .cartridge game file; its thumbnail becomes the entry's. */
  cartridge: Uint8Array;
  /** Signed ROMs. */
  a78: Uint8Array;
  bin: Uint8Array;
  clip?: Uint8Array | null;
}

export const entryTitle = (words: EntryWords, gameTitle: string) => words.title.trim() || gameTitle.trim() || "My game";

export const entryFileName = (title: string) => `${slugify(title)}-jam-entry.zip`;

function thumbnailOf(cartridge: Uint8Array): Uint8Array | undefined {
  try {
    return unzipSync(cartridge, { filter: (f) => f.name === "thumbnail.png" })["thumbnail.png"];
  } catch {
    return undefined;
  }
}

const cut = (s: string, n: number) => s.trim().slice(0, n);

export function entryZip(i: EntryInput): Uint8Array {
  const title = cut(entryTitle(i.words, i.gameTitle), ENTRY_LIMITS.title);
  const slug = slugify(title);
  const thumbnail = thumbnailOf(i.cartridge);
  const entry: Entry = {
    format: ENTRY_FORMAT,
    version: ENTRY_VERSION,
    jam: { name: i.brief.name, theme: i.brief.theme },
    title,
    credits: cut(i.words.credits, ENTRY_LIMITS.credits),
    description: cut(i.words.description, ENTRY_LIMITS.description),
    controls: cut(i.words.controls, ENTRY_LIMITS.controls),
    files: {
      player: "play.html",
      cartridge: `${slug}${CARTRIDGE_EXTENSION}`,
      a78: `${slug}.a78`,
      bin: `${slug}.bin`,
      ...(i.clip ? { clip: "clip.gif" } : {}),
      ...(thumbnail ? { thumbnail: "thumbnail.png" } : {}),
    },
    madeWith: "Cartridge Studio",
  };
  const root = `${slug}-jam-entry`;
  const files: Record<string, Uint8Array> = {
    [`${root}/entry.json`]: strToU8(`${JSON.stringify(entry, null, 2)}\n`),
    [`${root}/README.txt`]: strToU8(readme(entry)),
    [`${root}/play.html`]: strToU8(i.playerHtml),
    [`${root}/${entry.files.cartridge}`]: i.cartridge,
    [`${root}/${entry.files.a78}`]: i.a78,
    [`${root}/${entry.files.bin}`]: i.bin,
  };
  if (i.clip) files[`${root}/clip.gif`] = i.clip;
  if (thumbnail) files[`${root}/thumbnail.png`] = thumbnail;
  // Already-compressed files (GIF, PNG, the .cartridge ZIP) gain nothing from deflating.
  return zipSync(files, { level: 6, mtime: MTIME });
}

function readme(e: Entry): string {
  return `${e.title} - entry for ${e.jam.name}
${"=".repeat(e.title.length + e.jam.name.length + 13)}
${e.credits ? `\nBy ${e.credits}\n` : ""}${e.description ? `\n${e.description}\n` : ""}${e.controls ? `\nControls: ${e.controls}\n` : ""}
  play.html          open in any web browser to play, no internet needed
  ${e.files.cartridge.padEnd(18)} the game file; open it in Cartridge Studio to see how it's made
  ${e.files.a78.padEnd(18)} signed ROM for emulators and flash carts
  ${e.files.bin.padEnd(18)} plain signed ROM for flash carts and real consoles
${e.files.clip ? "  clip.gif           a few seconds of play\n" : ""}  entry.json         these details, for the jam's gallery builder

Made with Cartridge Studio. Not affiliated with or endorsed by Atari.
`;
}

export interface ReadEntry {
  entry: Entry;
  files: { player: Uint8Array; cartridge: Uint8Array; a78: Uint8Array; bin: Uint8Array; clip?: Uint8Array; thumbnail?: Uint8Array };
}

export type ReadEntryResult = { ok: true; read: ReadEntry } | { ok: false; error: string };

/** Reads an entry ZIP; entry.json may sit at the top or in one folder. */
export function readEntryZip(bytes: Uint8Array): ReadEntryResult {
  let zip: Record<string, Uint8Array>;
  try {
    zip = unzipSync(bytes);
  } catch {
    return { ok: false, error: "This isn't a ZIP file." };
  }
  const marker = Object.keys(zip)
    .filter((n) => /(^|\/)entry\.json$/.test(n) && n.split("/").length <= 2)
    .sort((a, b) => a.length - b.length)[0];
  if (!marker) return { ok: false, error: "This ZIP isn't a jam entry: it has no entry.json." };
  const dir = marker.slice(0, -"entry.json".length);
  let json: unknown;
  try {
    json = JSON.parse(strFromU8(zip[marker]!));
  } catch {
    return { ok: false, error: "This entry's entry.json is damaged." };
  }
  if ((json as { format?: unknown } | null)?.format !== ENTRY_FORMAT) return { ok: false, error: "This ZIP isn't a Cartridge Studio jam entry." };
  const v = (json as { version?: unknown }).version;
  if (typeof v === "number" && v > ENTRY_VERSION) return { ok: false, error: "This entry was made by a newer version of Cartridge Studio." };
  const parsed = EntrySchema.safeParse(json);
  if (!parsed.success) return { ok: false, error: `This entry's entry.json is damaged (${parsed.error.issues[0]?.message ?? "unknown"}).` };
  const entry = parsed.data;
  const get = (name: string | undefined) => (name ? zip[dir + name] : undefined);
  const need = { player: get(entry.files.player), cartridge: get(entry.files.cartridge), a78: get(entry.files.a78), bin: get(entry.files.bin) };
  const missing = Object.entries(need).filter(([, d]) => !d).map(([k]) => k);
  if (missing.length) return { ok: false, error: `This entry is missing files: ${missing.join(", ")}.` };
  return {
    ok: true,
    read: {
      entry,
      files: { ...(need as ReadEntry["files"]), clip: get(entry.files.clip), thumbnail: get(entry.files.thumbnail) },
    },
  };
}
