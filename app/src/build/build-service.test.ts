import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkerBuildService } from "./build-service.ts";
import { buildFault, type WorkerRequest, type WorkerResponse } from "./protocol.ts";
import type { GameSource } from "./project-build.ts";

/** A stand-in for the build worker: answers init with ready, and builds however the test says. */
class FakeWorker {
  static onBuild: (w: FakeWorker, msg: Extract<WorkerRequest, { type: "build" }>) => void = () => {};
  onmessage: ((e: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminated = false;

  postMessage(msg: WorkerRequest) {
    queueMicrotask(() => {
      if (this.terminated) return;
      if (msg.type === "init") this.send({ type: "ready", toolchainVersion: "test", fetchMs: 0, compileMs: 0 });
      else FakeWorker.onBuild(this, msg);
    });
  }
  send(msg: WorkerResponse) {
    this.onmessage?.({ data: msg } as MessageEvent<WorkerResponse>);
  }
  terminate() {
    this.terminated = true;
  }
}

const game = {} as GameSource;

describe("WorkerBuildService faults", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fails the build at once when the worker throws, instead of timing out", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    FakeWorker.onBuild = (w) => w.onerror?.({ message: "Uncaught TypeError: boom", preventDefault() {} } as ErrorEvent);
    const s = new WorkerBuildService({ packUrl: "pack", timeoutMs: 60_000 });
    await s.ready;
    const t0 = performance.now();
    const r = await s.build(game);
    expect(performance.now() - t0).toBeLessThan(1000);
    expect(r).toMatchObject({ kind: "failed", stage: "worker" });
    expect(r.kind === "failed" && r.message).toContain("boom");
    expect(r.kind === "failed" && r.message).not.toMatch(/longer than/);
    s.dispose();
  });

  it("builds again on a fresh worker after a fault", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    let calls = 0;
    FakeWorker.onBuild = (w, msg) => {
      if (calls++ === 0) w.onerror?.({ message: "boom", preventDefault() {} } as ErrorEvent);
      else w.send({ type: "result", id: msg.id, result: { kind: "invalid", errors: ["ok"], generateMs: 0, buildMs: 0, totalMs: 0 } });
    };
    const s = new WorkerBuildService({ packUrl: "pack", timeoutMs: 60_000 });
    expect((await s.build(game)).kind).toBe("failed");
    expect((await s.build(game)).kind).toBe("invalid");
    s.dispose();
  });

  it("passes on a fault the worker caught itself", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    FakeWorker.onBuild = (w, msg) => w.send({ type: "result", id: msg.id, result: buildFault(new TypeError("x is undefined")) });
    const s = new WorkerBuildService({ packUrl: "pack", timeoutMs: 60_000 });
    const r = await s.build(game);
    expect(r).toMatchObject({ kind: "failed", stage: "worker", message: "Internal error in the build worker: x is undefined" });
    s.dispose();
  });
});

describe("buildFault", () => {
  it("keeps the stack as the log and handles non-Error throws", () => {
    const e = new Error("bad");
    expect(buildFault(e)).toMatchObject({ kind: "failed", stage: "worker", log: e.stack });
    expect(buildFault("plain")).toMatchObject({ message: "Internal error in the build worker: plain", log: "" });
  });
});
