// What the About and licences dialog credits. Versions come from the files
// that pin them (toolchain.lock.json, the vendored js7800 README), never from
// strings written here, so the dialog can't drift from what actually ships.

import { TOOLCHAIN_LICENSE_FILES, TOOLCHAIN_URL, TOOLCHAIN_VERSION } from "@cartridge-studio/toolchain";
import js7800Readme from "../../public/vendor/js7800-core/README.md?raw";

/** The pinned js7800 commit, from the vendored core's README. */
export function js7800Commit(readme: string): string {
  const commit = /Commit: `([0-9a-f]{40})`/.exec(readme)?.[1];
  if (!commit) throw new Error("The vendored js7800 README doesn't name its commit");
  return commit;
}

export interface Credit {
  name: string;
  version: string;
  by: string;
  licence: string;
  note?: string;
  source: string;
  /** Licence texts served with the app, as [label, url]. */
  files: [string, string][];
}

const base = import.meta.env.BASE_URL;
const commit = js7800Commit(js7800Readme);
const [basicLicence, dasmLicence, basicReadme] = TOOLCHAIN_LICENSE_FILES.map((f) => `${base}toolchain/${f}`);

export const CREDITS: Credit[] = [
  {
    name: "7800basic",
    version: TOOLCHAIN_VERSION,
    by: "Mike Saarna (RevEng), derived from batari Basic by Fred Quimby",
    licence: "GNU GPL v2. Its 6502 runtime is CC0, and the games you build with it are yours.",
    note: "Runs as the release's own WebAssembly build, unmodified.",
    source: `https://github.com/7800-devtools/7800basic/tree/v${TOOLCHAIN_VERSION}`,
    files: [
      ["Licence", basicLicence!],
      ["Read me", basicReadme!],
      ["Release download", TOOLCHAIN_URL],
    ],
  },
  {
    name: "dasm",
    version: `as bundled with 7800basic ${TOOLCHAIN_VERSION}`,
    by: "the dasm team",
    licence: "GNU GPL v2",
    source: "https://github.com/dasm-assembler/dasm",
    files: [["Licence", dasmLicence!]],
  },
  {
    name: "js7800",
    version: `commit ${commit.slice(0, 7)}`,
    by: "raz0red, based on the ProSystem emulator by Greg Stanton",
    licence: "GNU GPL v2 or later",
    note: "Built from upstream source at this commit with two worker-safe I/O stand-ins (app/js7800-core/, app/scripts/build-js7800.mjs), then minified.",
    source: `https://github.com/raz0red/js7800/tree/${commit}`,
    files: [
      ["Licence", `${base}vendor/js7800-core/LICENSE`],
      ["Third-party licences", `${base}vendor/js7800-core/LICENSE-third-party`],
      ["Build notes", `${base}vendor/js7800-core/README.md`],
    ],
  },
  {
    name: "Atkinson Hyperlegible",
    version: "font for the print kit",
    by: "the Braille Institute",
    licence: "SIL Open Font License 1.1",
    source: "https://fonts.google.com/",
    files: [
      ["Atkinson Hyperlegible licence", `${base}fonts/atkinson-hyperlegible-OFL.txt`],
    ],
  },
];

/** Copied into public/legal by scripts/vendor.mjs. */
export const LICENSE_URL = `${base}legal/LICENSE.txt`;
export const NOTICES_URL = `${base}legal/THIRD_PARTY_NOTICES.txt`;
