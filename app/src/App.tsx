// M0 toolchain spike page: edit a hand-written 7800basic program, build it in
// the build worker, and run the ROM in js7800. Not the M1 editor.

import { useCallback, useEffect, useRef, useState } from "react";
import { M0_SPRITES, encodeIndexedPng, type BuildResult, type BuildSuccess } from "@cartridge-studio/toolchain";
import testProgram from "@cartridge-studio/toolchain/fixtures/m0-test.bas?raw";
import { InlineBuilder } from "./build/inline-builder.ts";
import { WorkerBuilder, type WorkerReadyInfo } from "./build/worker-builder.ts";
import { Js7800Emulator } from "./emulator/js7800-emulator.ts";

interface BuildRecord {
  n: number;
  ok: boolean;
  /** Time inside the worker, stage by stage. */
  workerMs: number;
  /** Main-thread wall time from request to ROM in hand, including messaging. */
  wallMs: number;
  stages: string;
}

const spriteFiles = () =>
  Object.fromEntries(Object.entries(M0_SPRITES).map(([name, rows]) => [name, encodeIndexedPng(rows)]));

function download(data: Uint8Array, name: string) {
  const url = URL.createObjectURL(new Blob([data as Uint8Array<ArrayBuffer>], { type: "application/octet-stream" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
};

declare global {
  interface Window {
    /** Hooks for the Playwright spike test. */
    __m0?: { emulator?: Js7800Emulator; builds: BuildRecord[]; ready?: WorkerReadyInfo; last?: BuildResult };
  }
}

export function App() {
  const [source, setSource] = useState(testProgram);
  const [optimize, setOptimize] = useState(false);
  const [ready, setReady] = useState<WorkerReadyInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [builds, setBuilds] = useState<BuildRecord[]>([]);
  const [last, setLast] = useState<BuildResult | null>(null);
  const [rom, setRom] = useState<BuildSuccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bench, setBench] = useState<string | null>(null);

  const builder = useRef<WorkerBuilder | InlineBuilder | null>(null);
  const emulator = useRef<Js7800Emulator | null>(null);
  const emuContainer = useRef<HTMLDivElement>(null);
  const counter = useRef(0);

  const runBuild = useCallback(
    async (src: string, opt: boolean, { load = true } = {}): Promise<BuildRecord | null> => {
      const b = builder.current;
      if (!b) return null;
      const t0 = performance.now();
      const result = await b.build({ source: src, files: spriteFiles(), optimize: opt });
      const wallMs = performance.now() - t0;
      const record: BuildRecord = {
        n: ++counter.current,
        ok: result.ok,
        workerMs: result.totalMs,
        wallMs,
        stages: result.timings.map((t) => `${t.stage} ${t.ms.toFixed(0)}`).join(" · "),
      };
      console.info(
        `[build #${record.n}] ${result.ok ? "ok" : `failed in ${result.stage}`} ` +
          `wall ${wallMs.toFixed(1)} ms, worker ${result.totalMs.toFixed(1)} ms (${record.stages})`,
      );
      setBuilds((bs) => [record, ...bs].slice(0, 50));
      setLast(result);
      window.__m0!.builds.unshift(record);
      window.__m0!.last = result;
      if (result.ok) {
        setRom(result);
        setError(null);
        if (load) await emulator.current?.load(result.a78, "a78");
      } else {
        // Keep the last good ROM running, as the spec asks.
        setError(`Build failed in ${result.stage}: ${result.message}`);
      }
      return record;
    },
    [],
  );

  useEffect(() => {
    window.__m0 = { builds: [] };
    // `?builder=inline` runs builds on the main thread, for throttled measurements only.
    const inline = new URLSearchParams(location.search).get("builder") === "inline";
    const b = inline ? new InlineBuilder() : new WorkerBuilder();
    builder.current = b;
    let cancelled = false;
    (async () => {
      try {
        emulator.current = await Js7800Emulator.create(emuContainer.current!, (m) => setError(m));
        window.__m0!.emulator = emulator.current;
        const info = await b.ready;
        if (cancelled) return;
        console.info(
          `[toolchain] ${info.toolchainVersion} ready in ${info.totalMs.toFixed(0)} ms ` +
            `(fetch ${info.fetchMs.toFixed(0)} ms, compile ${info.compileMs.toFixed(0)} ms)`,
        );
        window.__m0!.ready = info;
        setReady(info);
        setBusy(true);
        await runBuild(testProgram, false);
        setBusy(false);
      } catch (e) {
        setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
      b.terminate();
    };
  }, [runBuild]);

  const onBuild = async () => {
    setBusy(true);
    await runBuild(source, optimize);
    setBusy(false);
  };

  const onBenchmark = async () => {
    setBusy(true);
    const walls: number[] = [];
    for (let i = 0; i < 20; i++) {
      const r = await runBuild(source, optimize, { load: false });
      if (r) walls.push(r.wallMs);
    }
    const summary =
      `20 builds: median ${median(walls).toFixed(1)} ms, ` +
      `min ${Math.min(...walls).toFixed(1)} ms, max ${Math.max(...walls).toFixed(1)} ms`;
    console.info(`[benchmark] ${summary}`);
    setBench(summary);
    setBusy(false);
  };

  const latest = builds[0];

  return (
    <div className="page">
      <header>
        <h1>Cartridge Studio</h1>
        <span className="tag">M0 · toolchain spike</span>
      </header>

      <main>
        <section className="editor">
          <div className="toolbar">
            <button onClick={onBuild} disabled={!ready || busy}>
              Build &amp; run
            </button>
            <button onClick={onBenchmark} disabled={!ready || busy} className="secondary">
              Benchmark ×20
            </button>
            <label>
              <input type="checkbox" checked={optimize} onChange={(e) => setOptimize(e.target.checked)} /> optimize
            </label>
            <span className="spacer" />
            <button className="secondary" disabled={!rom} onClick={() => rom && download(rom.a78, "m0-test.a78")}>
              .a78
            </button>
            <button className="secondary" disabled={!rom} onClick={() => rom && download(rom.bin, "m0-test.bin")}>
              .bin
            </button>
          </div>
          <textarea
            aria-label="7800basic source"
            spellCheck={false}
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
        </section>

        <section className="preview">
          <div ref={emuContainer} className="emu" />
          <p className="hint">Arrows move · Space fires (changes the background)</p>

          <dl className="stats">
            <dt>Toolchain</dt>
            <dd data-testid="toolchain">
              {ready
                ? `${ready.toolchainVersion}, ready in ${ready.totalMs.toFixed(0)} ms (fetch ${ready.fetchMs.toFixed(0)}, compile ${ready.compileMs.toFixed(0)})`
                : "loading…"}
            </dd>
            <dt>Last build</dt>
            <dd data-testid="last-build">
              {latest
                ? `${latest.ok ? "ok" : "failed"} · ${latest.wallMs.toFixed(0)} ms wall · ${latest.workerMs.toFixed(0)} ms in worker`
                : "—"}
            </dd>
            {latest && (
              <>
                <dt>Stages</dt>
                <dd className="mono">{latest.stages}</dd>
              </>
            )}
            {rom && (
              <>
                <dt>ROM</dt>
                <dd>
                  .a78 {rom.a78.length} bytes · .bin {rom.bin.length} bytes
                </dd>
              </>
            )}
            {bench && (
              <>
                <dt>Benchmark</dt>
                <dd data-testid="benchmark">{bench}</dd>
              </>
            )}
          </dl>
          {error && <p className="error">{error}</p>}
        </section>
      </main>

      <details className="log">
        <summary>Compiler output</summary>
        <pre>{last?.log ?? ""}</pre>
      </details>
    </div>
  );
}
