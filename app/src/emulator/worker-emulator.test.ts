import { afterEach, describe, expect, it, vi } from "vitest";
import type { EmuRequest, EmuResponse } from "./protocol.ts";
import { WorkerEmulator } from "./worker-emulator.ts";

/** A stand-in emulator worker: ready at once; the test sends whatever else it needs. */
class FakeWorker {
  static last: FakeWorker;
  onmessage: ((e: MessageEvent<EmuResponse>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  sent: EmuRequest[] = [];
  constructor() {
    FakeWorker.last = this;
  }
  postMessage(msg: EmuRequest) {
    this.sent.push(msg);
    if (msg.type === "init") queueMicrotask(() => this.send({ type: "ready" }));
  }
  send(msg: EmuResponse) {
    this.onmessage?.({ data: msg } as MessageEvent<EmuResponse>);
  }
  terminate() {}
}

function stubPage() {
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("location", { href: "http://localhost/" });
  vi.stubGlobal("window", { addEventListener() {}, removeEventListener() {} });
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => {});
  const canvas = { transferControlToOffscreen: () => ({}), addEventListener() {}, removeEventListener() {}, focus() {} };
  return new WorkerEmulator(canvas as unknown as HTMLCanvasElement);
}

describe("WorkerEmulator faults", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reports a stopped loop once, and fails requests still waiting", async () => {
    const emu = stubPage();
    const faults: string[] = [];
    emu.onFault((m) => faults.push(m));
    const pending = emu.framebufferHash();
    await Promise.resolve();
    await Promise.resolve();
    FakeWorker.last.send({ type: "fault", message: "tick threw" });
    FakeWorker.last.send({ type: "fault", message: "again" });
    await expect(pending).rejects.toThrow("tick threw");
    expect(faults).toEqual(["tick threw"]);
    expect(emu.fault).toBe("tick threw");
    emu.dispose();
  });

  it("treats an uncaught worker error as a fault", () => {
    const emu = stubPage();
    const faults: string[] = [];
    emu.onFault((m) => faults.push(m));
    FakeWorker.last.onerror?.({ message: "Uncaught RangeError" } as ErrorEvent);
    expect(faults).toEqual(["Uncaught RangeError"]);
    emu.dispose();
  });

  it("sends the test hook to the worker", () => {
    const emu = stubPage();
    emu.injectFault();
    expect(FakeWorker.last.sent.at(-1)).toEqual({ type: "inject-fault" });
    emu.dispose();
  });
});
