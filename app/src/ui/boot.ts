// Boot reports: what someone who tried a game on a console copies into the
// GitHub issue template, and the compatibility table those reports fill in
// (compatibility.json at the repo root, which the site reads too). Nothing
// goes in a URL.

import compat from "../../../compatibility.json";

/** The issue form at .github/ISSUE_TEMPLATE/boot-report.yml. The report itself is pasted, never sent in the link. */
export const BOOT_REPORT_URL = "https://github.com/AnnabelleChimpton/CartridgeStudio/issues/new?template=boot-report.yml";

/** One row per boot report. */
export interface CompatRow {
  console: string;
  firmware: string;
  cartridge: string;
  result: string;
  date: string;
  /** The boot report's issue, when there is one. */
  report: string | null;
}

/** The table, and the line it shows while it has no rows. */
export const COMPAT: { note: string; rows: CompatRow[] } = compat as { note: string; rows: CompatRow[] };

export type BootAnswer = "yes" | "no" | "not-yet";

export interface BootInfo {
  title: string;
  /** The Cartridge Studio build and the toolchain, e.g. "0.3.0+a9edf50", "7800basic 0.41". */
  app: string;
  toolchain?: string;
  /** The ROM file last downloaded, if any. */
  file?: { name: string; bytes: number; sha256: string };
  answer?: BootAnswer;
}

const ANSWERS: Record<BootAnswer, string> = { yes: "It booted", no: "It didn't boot", "not-yet": "" };

/** The text "Copy boot report" copies: what the app knows, then blanks for what only the person at the console knows. */
export function bootReport(i: BootInfo): string {
  return [
    `Game: ${i.title || "Untitled"}`,
    i.file ? `ROM file: ${i.file.name}, ${i.file.bytes.toLocaleString("en-US")} bytes` : "ROM file: not downloaded yet",
    ...(i.file ? [`ROM SHA-256: ${i.file.sha256}`] : []),
    `Made with: Cartridge Studio ${i.app}${i.toolchain ? `, ${i.toolchain}` : ""}`,
    "Console (7800, 7800+, 2600+):",
    "Flash cartridge and its firmware version:",
    `What happened (black screen, menu only, crash, booted and played): ${i.answer ? ANSWERS[i.answer] : ""}`.trimEnd(),
  ].join("\n");
}
