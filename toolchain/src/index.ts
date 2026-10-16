import lock from "../toolchain.lock.json" with { type: "json" };

export type { Builder, BuildInput, BuildResult, BuildSuccess, BuildFailure, StageTiming } from "./builder.ts";
export { WasiBuilder } from "./wasi-builder.ts";
export { readPack, type ToolchainPack } from "./pack.ts";
export { crc32, encodeIndexedPng } from "./png.ts";
export { M0_SPRITES } from "./fixtures/m0-test.ts";

/** File name of the packed toolchain this app version pins. */
export const TOOLCHAIN_PACK_FILE = `${lock.name}-${lock.version}.pack`;
