// Jam entries: the one package format (files/package.ts) with a `jam` block.
// The creator's words, licence and compilation permission go in the
// manifest, with the limits their game goes past and the build that made it.

import { packageZip, type LicenceId, type Manifest, type ReadPackage } from "../files/package.ts";
import type { JamBrief } from "./brief.ts";
import { cartridgeFacts, checkLimits, type GameFacts, type Limits } from "./limits.ts";
import type { EntryWords } from "./store.ts";

export interface EntryInput {
  brief: JamBrief;
  words: EntryWords;
  /** The game's own title, used when the words leave it empty. */
  gameTitle: string;
  /** What made it: app build, runtime and toolchain. */
  build: { app: string; runtime: string; toolchain: string; builtAt?: string };
  /** For checking the brief's limits; the ROM size is added here. */
  facts: GameFacts;
  /** The offline player page. */
  player: string;
  /** Signed ROMs. */
  a78: Uint8Array;
  bin: Uint8Array;
  /** The .cartridge game file, when the game has one; its thumbnail becomes the entry's. */
  cartridge?: Uint8Array;
  clip?: Uint8Array | null;
}

export const entryTitle = (words: EntryWords, gameTitle: string) => words.title.trim() || gameTitle.trim() || "My game";

/** Why the entry can't be made yet, if it can't. */
export function entryProblem(words: EntryWords): string | null {
  if (!words.licence) return "Choose a licence for your game first.";
  return null;
}

/** What the brief would flag about this game, before the entry is made. */
export function entryFlags(brief: JamBrief, facts: GameFacts, app: string): string[] {
  const flags = checkLimits(brief.limits, facts);
  if (brief.app && brief.app !== app) flags.push(`Made with Cartridge Studio ${app}; the jam uses ${brief.app}.`);
  return flags;
}

function readme(m: Manifest, jam: JamBrief): string {
  const heading = `${m.title} - entry for ${jam.name}`;
  return `${heading}
${"=".repeat(heading.length)}
${m.credits ? `\nBy ${m.credits}\n` : ""}${m.description ? `\n${m.description}\n` : ""}${m.controls ? `\nControls: ${m.controls}\n` : ""}
  play.html        open in any web browser to play, no internet needed
  rom/             signed ROMs: .a78 for emulators and flash carts, .bin for flash carts
  project/         the game file; open it in Cartridge Studio to see how it's made
  media/           a screenshot, and a clip if there is one
  manifest.json    these details, the licence and the build, for the jam's gallery builder

Made with Cartridge Studio. Not affiliated with or endorsed by Atari.
`;
}

export async function jamEntryZip(i: EntryInput): Promise<{ zip: Uint8Array; manifest: Manifest; name: string }> {
  const problem = entryProblem(i.words);
  if (problem) throw new Error(problem);
  const title = entryTitle(i.words, i.gameTitle);
  const flags = entryFlags(i.brief, { ...i.facts, romBytes: i.a78.length }, i.build.app);
  const jam = {
    name: i.brief.name,
    theme: i.brief.theme,
    ...(i.brief.app ? { pinnedApp: i.brief.app } : {}),
    compilation: i.words.compilation,
    flags,
  };
  // The README needs the manifest's tidied words, so write it in a second pass.
  const base = {
    kind: "jam-entry" as const,
    title,
    words: i.words,
    licence: i.words.licence as LicenceId,
    build: { ...i.build, builtAt: i.build.builtAt ?? new Date().toISOString() },
    a78: i.a78,
    bin: i.bin,
    player: i.player,
    cartridgeFile: i.cartridge,
    clip: i.clip,
    jam,
  };
  const first = await packageZip({ ...base, notes: { name: "README.txt", text: "" } });
  return packageZip({ ...base, notes: { name: "README.txt", text: readme(first.manifest, i.brief) } });
}

/**
 * The organizer's own checks of an entry, not trusting its manifest's flags:
 * limits (from its game file), the pinned build, the licence and the jam.
 */
export function organizerFlags(read: ReadPackage, jam: { name?: string; app?: string; limits?: Limits }): string[] {
  const m = read.manifest;
  const flags: string[] = [];
  if (jam.name && m.jam && m.jam.name !== jam.name) flags.push(`Made for another jam: ${m.jam.name}.`);
  if (!m.jam) flags.push("Not made as a jam entry.");
  if (!m.licence) flags.push("No licence chosen.");
  if (jam.app && m.build.app !== jam.app) flags.push(`Made with Cartridge Studio ${m.build.app}; the jam uses ${jam.app}.`);
  const limits = jam.limits ?? {};
  const facts = read.files.cartridge ? cartridgeFacts(read.files.cartridge) : null;
  const kitLimits = (["maxTypes", "maxRules", "maxCounters", "maxPalettes"] as const).some((k) => limits[k] !== undefined);
  if (kitLimits && !facts) flags.push("No kit game file, so only the ROM size could be checked.");
  flags.push(...checkLimits(limits, { ...facts, romBytes: read.files.a78.length }));
  return flags;
}
