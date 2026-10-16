// Runs the same WasiBuilder on the main thread. Only for measurement
// (`?builder=inline`): Chrome's CPU throttling applies to the page's main
// thread but not to dedicated workers, so this is how the e2e test estimates
// build time on a slower machine.

import { TOOLCHAIN_PACK_FILE, WasiBuilder, readPack, type BuildInput, type BuildResult, type Builder } from "@cartridge-studio/toolchain";
import type { WorkerReadyInfo } from "./worker-builder.ts";

export class InlineBuilder implements Builder {
  toolchainVersion = "";
  readonly ready: Promise<WorkerReadyInfo>;
  private readonly builder: Promise<WasiBuilder>;

  constructor(packUrl = `${import.meta.env.BASE_URL}toolchain/${TOOLCHAIN_PACK_FILE}`) {
    const t0 = performance.now();
    let fetchMs = 0;
    this.builder = (async () => {
      const res = await fetch(packUrl);
      if (!res.ok) throw new Error(`Fetching toolchain failed: ${res.status}`);
      const pack = readPack(await res.arrayBuffer());
      fetchMs = performance.now() - t0;
      return WasiBuilder.create(pack);
    })();
    this.ready = this.builder.then((b) => {
      this.toolchainVersion = b.toolchainVersion;
      const totalMs = performance.now() - t0;
      return { toolchainVersion: b.toolchainVersion, fetchMs, compileMs: totalMs - fetchMs, totalMs };
    });
  }

  async build(input: BuildInput): Promise<BuildResult> {
    return (await this.builder).build(input);
  }

  terminate() {}
}
