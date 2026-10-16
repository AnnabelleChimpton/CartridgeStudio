import lock from "../toolchain.lock.json" with { type: "json" };

export type { Builder, BuildInput, BuildResult, BuildSuccess, BuildFailure, StageTiming } from "./builder.ts";
export { WasiBuilder } from "./wasi-builder.ts";
export { readPack, type ToolchainPack } from "./pack.ts";
export { crc32, encodeIndexedPng } from "./png.ts";
export { M0_SPRITES } from "./fixtures/m0-test.ts";

/** File name of the packed toolchain this app version pins. */
export const TOOLCHAIN_PACK_FILE = `${lock.name}-${lock.version}.pack`;

/** The toolchain this app version pins, as people write it ("7800basic 0.41"). */
export const TOOLCHAIN_NAME = `${lock.name} ${lock.version}`;
/** Where that release comes from. */
export const TOOLCHAIN_URL = lock.url;
/** The pinned release's version ("0.41") and the licence files served next to its pack. */
export const TOOLCHAIN_VERSION = lock.version;
export const TOOLCHAIN_LICENSE_FILES = lock.licenses.map((f) => `${lock.name}-${lock.version}-${f}`);
