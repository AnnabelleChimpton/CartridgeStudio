/// <reference lib="webworker" />
// Build worker: code generation, the ROM cache and the toolchain all run here,
// so a slow build never freezes the editor. The main thread cancels a build by
// terminating this worker and starting a new one.

import { WasiBuilder, readPack } from "@cartridge-studio/toolchain";
import { buildProject } from "./project-build.ts";
import { buildFault, type WorkerRequest, type WorkerResponse } from "./protocol.ts";
import { idbRomCache } from "./rom-cache.ts";

declare const self: DedicatedWorkerGlobalScope;

let builder: Promise<WasiBuilder> | undefined;
const cache = idbRomCache();

function post(msg: WorkerResponse, transfer: Transferable[] = []) {
  self.postMessage(msg, transfer);
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  if (msg.type === "init") {
    builder = (async () => {
      const t0 = performance.now();
      const res = await fetch(msg.packUrl);
      if (!res.ok) throw new Error(`Fetching toolchain failed: ${res.status}`);
      const pack = readPack(await res.arrayBuffer());
      const t1 = performance.now();
      const b = await WasiBuilder.create(pack);
      post({ type: "ready", toolchainVersion: b.toolchainVersion, fetchMs: t1 - t0, compileMs: performance.now() - t1 });
      return b;
    })();
    builder.catch((err: unknown) => post({ type: "init-error", message: String(err) }));
    return;
  }

  if (msg.type === "build") {
    // Anything that throws (a generator bug, a malformed game) is reported as
    // this build's fault, not left to look like a timeout.
    const t0 = performance.now();
    try {
      if (!builder) throw new Error("The build worker wasn't initialized");
      const result = await buildProject(await builder, msg.project, cache, msg.options);
      post({ type: "result", id: msg.id, result }, result.kind === "built" ? [result.a78.buffer, result.bin.buffer] : []);
    } catch (err) {
      post({ type: "result", id: msg.id, result: buildFault(err, performance.now() - t0) });
    }
  }
};
