// Main-thread side of project builds. Only the latest build matters: starting
// a new one while another runs terminates the worker and respawns it from the
// HTTP-cached toolchain (SPEC.md, "How it runs"). The same mechanism enforces a
// timeout, so a compiler that hangs can't wedge the preview.

import { TOOLCHAIN_PACK_FILE, WasiBuilder, readPack } from "@cartridge-studio/toolchain";
import { buildProject, type BuildOptions, type GameSource, type ProjectBuildResult } from "./project-build.ts";
import { buildFault, type WorkerRequest, type WorkerResponse } from "./protocol.ts";
import { idbRomCache } from "./rom-cache.ts";

export interface ReadyInfo {
  toolchainVersion: string;
  fetchMs: number;
  compileMs: number;
  /** Wall time from start to ready, as the main thread saw it. */
  totalMs: number;
}

export interface BuildService {
  /** Resolves when the first toolchain instance is ready. */
  readonly ready: Promise<ReadyInfo>;
  /** Builds `project`. A newer call cancels this one, which then resolves as `cancelled`. */
  build(project: GameSource, options?: BuildOptions): Promise<ProjectBuildResult>;
  dispose(): void;
}

const DEFAULT_PACK_URL = () => new URL(`${import.meta.env.BASE_URL}toolchain/${TOOLCHAIN_PACK_FILE}`, location.href).href;
const cancelled = (): ProjectBuildResult => ({ kind: "cancelled", generateMs: 0, buildMs: 0, totalMs: 0 });

export class WorkerBuildService implements BuildService {
  readonly ready: Promise<ReadyInfo>;
  private worker!: Worker;
  private workerReady!: Promise<ReadyInfo>;
  private nextId = 1;
  private inFlight: { id: number; resolve: (r: ProjectBuildResult) => void; timer: ReturnType<typeof setTimeout> } | null =
    null;
  private readonly packUrl: string;
  private readonly timeoutMs: number;

  constructor({ packUrl = DEFAULT_PACK_URL(), timeoutMs = 15_000 } = {}) {
    this.packUrl = packUrl;
    this.timeoutMs = timeoutMs;
    this.spawn();
    this.ready = this.workerReady;
  }

  private spawn() {
    const t0 = performance.now();
    this.worker = new Worker(new URL("./build.worker.ts", import.meta.url), { type: "module" });
    this.workerReady = new Promise((resolve, reject) => {
      this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const msg = e.data;
        if (msg.type === "ready") resolve({ ...msg, totalMs: performance.now() - t0 });
        else if (msg.type === "init-error") reject(new Error(msg.message));
        else if (msg.type === "result" && this.inFlight?.id === msg.id) this.finish(msg.result);
      };
      // An uncaught error or an unreadable message fails the build in flight at
      // once (rather than at the timeout), and the next build gets a fresh worker.
      this.worker.onerror = (e) => {
        e.preventDefault?.();
        const err = new Error(e.message || "The build worker stopped");
        reject(err);
        this.fault(err);
      };
      this.worker.onmessageerror = () => this.fault(new Error("The build worker sent a message the page couldn't read"));
    });
    this.workerReady.catch(() => {});
    this.post({ type: "init", packUrl: this.packUrl });
  }

  private post(msg: WorkerRequest) {
    this.worker.postMessage(msg);
  }

  private finish(result: ProjectBuildResult) {
    const f = this.inFlight;
    if (!f) return;
    clearTimeout(f.timer);
    this.inFlight = null;
    f.resolve(result);
  }

  private fault(err: Error) {
    if (!this.inFlight) return;
    this.restart();
    this.finish(buildFault(err));
  }

  /** Stops whatever the worker is doing and starts a fresh one. */
  private restart() {
    this.worker.terminate();
    this.spawn();
  }

  async build(project: GameSource, options: BuildOptions = {}): Promise<ProjectBuildResult> {
    if (this.inFlight) {
      this.finish(cancelled());
      this.restart();
    }
    const id = this.nextId++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (this.inFlight?.id !== id) return;
        this.restart();
        this.finish({
          kind: "failed",
          stage: "timeout",
          message: `The build took longer than ${this.timeoutMs / 1000} s`,
          log: "",
          source: "",
          generateMs: 0,
          buildMs: this.timeoutMs,
          totalMs: this.timeoutMs,
        });
      }, this.timeoutMs);
      this.inFlight = { id, resolve, timer };
      // Wait for the current worker (it may have just been respawned) before sending.
      this.workerReady.then(
        () => this.inFlight?.id === id && this.post({ type: "build", id, project, options }),
        (err: unknown) =>
          this.inFlight?.id === id &&
          this.finish({ kind: "failed", stage: "toolchain", message: String(err), log: "", source: "", generateMs: 0, buildMs: 0, totalMs: 0 }),
      );
    });
  }

  dispose() {
    if (this.inFlight) this.finish(cancelled());
    this.worker.terminate();
  }
}

/**
 * Runs builds on the main thread. Only for measurement (`?builder=inline`):
 * Chrome's CPU throttling applies to the page's main thread but not to
 * dedicated workers, so this is how the e2e test estimates slower machines.
 */
export class InlineBuildService implements BuildService {
  readonly ready: Promise<ReadyInfo>;
  private readonly builder: Promise<WasiBuilder>;
  private readonly cache = idbRomCache();
  private latest = 0;

  constructor({ packUrl = DEFAULT_PACK_URL() } = {}) {
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
      const totalMs = performance.now() - t0;
      return { toolchainVersion: b.toolchainVersion, fetchMs, compileMs: totalMs - fetchMs, totalMs };
    });
  }

  async build(project: GameSource, options: BuildOptions = {}): Promise<ProjectBuildResult> {
    const id = ++this.latest;
    const result = await buildProject(await this.builder, project, this.cache, options);
    return id === this.latest ? result : cancelled();
  }

  dispose() {}
}
