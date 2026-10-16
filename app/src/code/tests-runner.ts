// Main-thread side of the creator-test worker. Only the latest run matters:
// a new build or a new test terminates a run still going and starts afresh,
// and a run that takes too long (a test that waits forever) is stopped.

import type { TestsFile, TestResult } from "./creator-tests.ts";
import type { TestsRequest, TestsResponse } from "./tests.worker.ts";

const CORE_URL = () => new URL(`${import.meta.env.BASE_URL}vendor/js7800-core/js7800-core.js`, location.href).href;

export type RunOutcome = { kind: "done"; results: TestResult[] } | { kind: "error"; message: string } | { kind: "cancelled" };

export class TestsRunner {
  private worker: Worker | null = null;
  private nextId = 1;
  private inFlight: { id: number; resolve: (o: RunOutcome) => void; timer: ReturnType<typeof setTimeout> } | null = null;
  private readonly timeoutMs: number;

  constructor({ timeoutMs = 30_000 } = {}) {
    this.timeoutMs = timeoutMs;
  }

  private spawn(): Worker {
    const w = new Worker(new URL("./tests.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<TestsResponse>) => {
      if (e.data.id !== this.inFlight?.id) return;
      this.finish(e.data.type === "results" ? { kind: "done", results: e.data.results } : { kind: "error", message: e.data.message });
    };
    w.onerror = (e) => this.finish({ kind: "error", message: e.message || "The test runner stopped" });
    return w;
  }

  private finish(o: RunOutcome) {
    const f = this.inFlight;
    if (!f) return;
    clearTimeout(f.timer);
    this.inFlight = null;
    f.resolve(o);
  }

  /** Stops whatever is running, so a fresh worker takes the next run. */
  private stop() {
    if (!this.inFlight) return;
    this.finish({ kind: "cancelled" });
    this.worker?.terminate();
    this.worker = null;
  }

  run(a78: Uint8Array, symbols: string, file: TestsFile): Promise<RunOutcome> {
    this.stop();
    const id = this.nextId++;
    this.worker ??= this.spawn();
    const worker = this.worker;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (this.inFlight?.id !== id) return;
        this.finish({ kind: "error", message: `The test run passed ${this.timeoutMs / 1000} s and was stopped. Your tests are saved; one may wait on a value that never comes.` });
        worker.terminate();
        if (this.worker === worker) this.worker = null;
      }, this.timeoutMs);
      this.inFlight = { id, resolve, timer };
      worker.postMessage({ type: "run", id, coreUrl: CORE_URL(), a78: a78.slice(), symbols, file } satisfies TestsRequest);
    });
  }

  dispose() {
    this.stop();
    this.worker?.terminate();
    this.worker = null;
  }
}
