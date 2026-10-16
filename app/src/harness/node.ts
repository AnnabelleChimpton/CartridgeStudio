// Node-side setup for headless tests: the packed toolchain and the js7800
// core, loaded once per test file.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { TOOLCHAIN_PACK_FILE, WasiBuilder, readPack } from "@cartridge-studio/toolchain";
import { CoreHost, type Js7800Core } from "../emulator/core-host.ts";

const appDir = path.resolve(import.meta.dirname, "../..");

export async function nodeBuilder(): Promise<WasiBuilder> {
  const pack = path.resolve(appDir, "../toolchain/vendor", TOOLCHAIN_PACK_FILE);
  return WasiBuilder.create(readPack(fs.readFileSync(pack)));
}

export async function nodeHost(): Promise<CoreHost> {
  const url = pathToFileURL(path.resolve(appDir, "public/vendor/js7800-core/js7800-core.js")).href;
  return new CoreHost((await import(/* @vite-ignore */ url)) as Js7800Core);
}
