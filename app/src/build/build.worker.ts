/// <reference lib="webworker" />
// Build worker: fetches the toolchain pack once, compiles every tool once, then
// runs builds on request. Builds never touch the main thread.

import { WasiBuilder, readPack } from "@cartridge-studio/toolchain";
import type { WorkerRequest, WorkerResponse } from "./protocol.ts";

declare const self: DedicatedWorkerGlobalScope;

let builder: Promise<WasiBuilder> | undefined;

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
      post({
        type: "ready",
        toolchainVersion: b.toolchainVersion,
        fetchMs: t1 - t0,
        compileMs: performance.now() - t1,
      });
      return b;
    })();
    builder.catch((err: unknown) => post({ type: "init-error", message: String(err) }));
    return;
  }

  if (msg.type === "build") {
    if (!builder) throw new Error("Worker not initialized");
    const result = await (await builder).build(msg.input);
    post(
      { type: "built", id: msg.id, result },
      result.ok ? [result.a78.buffer, result.bin.buffer] : [],
    );
  }
};
