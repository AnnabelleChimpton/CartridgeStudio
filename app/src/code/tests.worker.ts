/// <reference lib="webworker" />
// Creator tests run here, on a headless js7800 core of their own, so a long
// test never holds up the editor or the preview. The main thread cancels a run
// by terminating this worker (tests-runner.ts).

import { CoreHost, type Js7800Core } from "../emulator/core-host.ts";
import { runCreatorTests, type TestsFile, type TestResult } from "./creator-tests.ts";

declare const self: DedicatedWorkerGlobalScope;

export type TestsRequest = { type: "run"; id: number; coreUrl: string; a78: Uint8Array; symbols: string; file: TestsFile };
export type TestsResponse = { type: "results"; id: number; results: TestResult[] } | { type: "error"; id: number; message: string };

let host: Promise<CoreHost> | null = null;

self.onmessage = async (e: MessageEvent<TestsRequest>) => {
  const msg = e.data;
  try {
    host ??= import(/* @vite-ignore */ msg.coreUrl).then((core) => new CoreHost(core as Js7800Core));
    const results = await runCreatorTests(await host, msg.a78, msg.symbols, msg.file);
    self.postMessage({ type: "results", id: msg.id, results } satisfies TestsResponse);
  } catch (err) {
    self.postMessage({ type: "error", id: msg.id, message: err instanceof Error ? err.message : String(err) } satisfies TestsResponse);
  }
};
