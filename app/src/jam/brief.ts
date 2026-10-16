// Jam briefs: what an organizer hands every creator. A small JSON file
// (name.jam.json) or the same JSON in a link (?jam=<base64url>), so a jam needs
// no server: post the link on itch.io, a forum or GitHub Pages.

import { strFromU8, strToU8 } from "fflate";
import { z } from "zod";
import { LimitsSchema } from "./limits.ts";

export const JAM_FORMAT = "cartridge-studio-jam";
export const JAM_VERSION = 1;
export const JAM_EXTENSION = ".jam.json";
/** The URL parameter a jam link carries. */
export const JAM_PARAM = "jam";

/** Starter games a brief can carry: .cartridge files, base64. */
export const MAX_STARTERS = 4;
export const MAX_STARTER_BYTES = 256 * 1024;
/** Past this, a link is too long for most chat apps and forums: share the file instead. */
export const LONG_LINK = 4000;

const text = (max: number) => z.string().trim().max(max);

const webLink = z
  .string()
  .trim()
  .max(500)
  .refine((s) => {
    try {
      const u = new URL(s);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  }, "The organizer link must be a web address starting with https://");

export const JamBriefSchema = z.object({
  format: z.literal(JAM_FORMAT),
  version: z.number().int().min(1),
  name: text(80).min(1, "The jam needs a name."),
  theme: text(120).default(""),
  /** As the organizer writes them, e.g. "Friday 6 pm to Sunday 6 pm (UTC)". */
  dates: text(120).default(""),
  /** Short rules in plain words, e.g. "One room", "Two colours". */
  constraints: z.array(text(120).min(1)).max(8).default([]),
  /** Built-in starting games (kit preset ids) to offer; empty means all of them. */
  presets: z.array(z.string().max(40)).max(20).default([]),
  /** The jam's own starting games. */
  starters: z
    .array(
      z.object({
        name: text(40).min(1),
        /** A .cartridge file, base64. */
        cartridge: z.string().max(Math.ceil(MAX_STARTER_BYTES / 3) * 4).regex(/^[A-Za-z0-9+/]*={0,2}$/),
      }),
    )
    .max(MAX_STARTERS)
    .default([]),
  /** What judges score, e.g. "Fun", "Theme", "Look and sound". */
  criteria: z.array(text(40).min(1)).max(8).default([]),
  /** Limits the app can check; going past one is flagged, not refused. */
  limits: LimitsSchema.default({}),
  /** The Cartridge Studio build the jam is pinned to (APP_VERSION): entries from other builds are flagged. */
  app: z.string().max(60).optional(),
  /** Where the jam lives: rules, submissions, chat. */
  link: webLink.optional(),
});

export type JamBrief = z.infer<typeof JamBriefSchema>;

export type BriefResult = { ok: true; brief: JamBrief } | { ok: false; errors: string[] };

export function newBrief(fields: Partial<Omit<JamBrief, "format" | "version">> & { name: string }): JamBrief {
  return JamBriefSchema.parse({ format: JAM_FORMAT, version: JAM_VERSION, ...fields });
}

export function parseBrief(json: unknown): BriefResult {
  if (typeof json !== "object" || json === null || (json as { format?: unknown }).format !== JAM_FORMAT) {
    return { ok: false, errors: ["This isn't a Cartridge Studio jam brief."] };
  }
  const version = (json as { version?: unknown }).version;
  if (typeof version === "number" && version > JAM_VERSION) {
    return { ok: false, errors: ["This jam brief was made by a newer version of Cartridge Studio."] };
  }
  const r = JamBriefSchema.safeParse(json);
  if (!r.success) return { ok: false, errors: r.error.issues.map((i) => i.message) };
  return { ok: true, brief: r.data };
}

export function readBriefText(s: string): BriefResult {
  try {
    return parseBrief(JSON.parse(s));
  } catch {
    return { ok: false, errors: ["This jam brief is damaged."] };
  }
}

/** The .jam.json file's text. */
export const briefFileText = (b: JamBrief) => `${JSON.stringify(b, null, 2)}\n`;

/** Only the fields that differ from the defaults, so links stay short. */
function compact(b: JamBrief): Record<string, unknown> {
  const out: Record<string, unknown> = { format: b.format, version: b.version, name: b.name };
  if (b.theme) out.theme = b.theme;
  if (b.dates) out.dates = b.dates;
  if (b.constraints.length) out.constraints = b.constraints;
  if (b.presets.length) out.presets = b.presets;
  if (b.starters.length) out.starters = b.starters;
  if (b.criteria.length) out.criteria = b.criteria;
  if (Object.keys(b.limits).length) out.limits = b.limits;
  if (b.app) out.app = b.app;
  if (b.link) out.link = b.link;
  return out;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** The brief as a ?jam= value: compact JSON, UTF-8, base64url. */
export const encodeBriefParam = (b: JamBrief) => toBase64Url(strToU8(JSON.stringify(compact(b))));

export function decodeBriefParam(value: string): BriefResult {
  try {
    return readBriefText(strFromU8(fromBase64Url(value.trim())));
  } catch {
    return { ok: false, errors: ["This jam link is damaged. Ask the organizer for it again."] };
  }
}

/** A link to the app (at `base`, e.g. location.origin + pathname) that opens this jam. */
export function briefLink(b: JamBrief, base: string): string {
  const u = new URL(base);
  u.search = "";
  u.hash = "";
  u.searchParams.set(JAM_PARAM, encodeBriefParam(b));
  return u.toString();
}

/** The presets to show, in the chooser's order: the brief's that exist, or all of them. */
export function offeredPresets(b: JamBrief | null, all: readonly string[]): string[] {
  if (!b || b.presets.length === 0) return [...all];
  const known = all.filter((id) => b.presets.includes(id));
  return known.length ? known : [...all];
}
