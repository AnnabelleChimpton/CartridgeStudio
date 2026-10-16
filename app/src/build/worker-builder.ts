// Main-thread side of the build worker, exposed as a Builder.

import { TOOLCHAIN_PACK_FILE, type BuildInput, type BuildResult, type Builder } from "@cartridge-studio/toolchain";
import type { WorkerRequest, WorkerResponse } from "./protocol.ts";

export interface WorkerReadyInfo {
  toolchainVersion: string;
  fetchMs: number;
  compileMs: number;
  /** Wall time from spawning the worker to ready, as the main thread saw it. */
  totalMs: number;
}

export class WorkerBuilder implements Builder {
  toolchainVersion = "";
  readonly ready: Promise<WorkerReadyInfo>;
  private readonly worker: Worker;
  private nextId = 1;
  private pending = new Map<number, (r: BuildResult) => void>();

  constructor(packUrl = `${import.meta.env.BASE_URL}toolchain/${TOOLCHAIN_PACK_FILE}`) {
    const t0 = performance.now();
    this.worker = new Worker(new URL("./build.worker.ts", import.meta.url), { type: "module" });
    this.ready = new Promise((resolve, reject) => {
      this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const msg = e.data;
        if (msg.type === "ready") {
          this.toolchainVersion = msg.toolchainVersion;
          resolve({ ...msg, totalMs: performance.now() - t0 });
        } else if (msg.type === "init-error") {
          reject(new Error(msg.message));
        } else if (msg.type === "built") {
          this.pending.get(msg.id)?.(msg.result);
          this.pending.delete(msg.id);
        }
      };
      this.worker.onerror = (e) => reject(new Error(e.message));
    });
    this.send({ type: "init", packUrl: new URL(packUrl, location.href).href });
  }

  async build(input: BuildInput): Promise<BuildResult> {
    await this.ready;
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.send({ type: "build", id, input });
    });
  }

  terminate() {
    this.worker.terminate();
  }

  private send(msg: WorkerRequest) {
    this.worker.postMessage(msg);
  }
}
