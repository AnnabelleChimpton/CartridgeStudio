// The preview loop both editors share: one build service and one emulator per
// editor; every change to the game rebuilds 300 ms later and reloads the ROM.

import { useEffect, useRef, useState } from "react";
import { InlineBuildService, WorkerBuildService, type BuildService, type ReadyInfo } from "../build/build-service.ts";
import type { GameSource, ProjectBuildResult } from "../build/project-build.ts";
import { WorkerEmulator } from "../emulator/worker-emulator.ts";
import type { Screenshot } from "../print/pdf.ts";
import type { useProjectStore } from "../project/store.ts";
import type { useKitStore } from "../kit/store.ts";

const BUILD_DEBOUNCE_MS = 300;

export type Built = Extract<ProjectBuildResult, { kind: "built" }>;

export interface BuildRecord {
  n: number;
  kind: ProjectBuildResult["kind"];
  cached: boolean;
  /** From the edit settling (debounce over) to the ROM in hand. */
  wallMs: number;
  generateMs: number;
  buildMs: number;
}

declare global {
  interface Window {
    /** Hooks for the Playwright tests. */
    __cs?: {
      store?: typeof useProjectStore;
      kitStore?: typeof useKitStore;
      service?: BuildService;
      /** Creates a separate worker service, e.g. with a short timeout. */
      createService?: (opts: ConstructorParameters<typeof WorkerBuildService>[0]) => BuildService;
      emulator?: WorkerEmulator;
      ready?: ReadyInfo;
      builds: BuildRecord[];
      last?: ProjectBuildResult;
    };
  }
}

export function download(data: Uint8Array, name: string) {
  const url = URL.createObjectURL(new Blob([data as Uint8Array<ArrayBuffer>], { type: "application/octet-stream" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function usePreview(source: GameSource) {
  const [ready, setReady] = useState<ReadyInfo | null>(null);
  const [building, setBuilding] = useState(false);
  const [result, setResult] = useState<ProjectBuildResult | null>(null);
  const [lastGood, setLastGood] = useState<Built | null>(null);
  const [record, setRecord] = useState<BuildRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const service = useRef<BuildService | null>(null);
  const emulator = useRef<WorkerEmulator | null>(null);
  const emuContainer = useRef<HTMLDivElement>(null);
  /** The game and its TV-mode title and hint; this is what goes full screen. */
  const stage = useRef<HTMLDivElement>(null);
  const counter = useRef(0);
  const sourceRef = useRef(source);
  sourceRef.current = source;

  // Build service and emulator, once per editor.
  useEffect(() => {
    window.__cs = { ...window.__cs, builds: [], createService: (opts) => new WorkerBuildService(opts) };
    const inline = new URLSearchParams(location.search).get("builder") === "inline";
    const s: BuildService = inline ? new InlineBuildService() : new WorkerBuildService();
    service.current = s;
    window.__cs.service = s;
    s.ready.then(
      (info) => {
        console.info(
          `[toolchain] ${info.toolchainVersion} ready in ${info.totalMs.toFixed(0)} ms ` +
            `(fetch ${info.fetchMs.toFixed(0)}, compile ${info.compileMs.toFixed(0)})`,
        );
        window.__cs!.ready = info;
        setReady(info);
      },
      (e: unknown) => setError(`The game builder couldn't start (${String(e)}). Reload the page to try again; your work is saved.`),
    );
    // A canvas can hand its drawing to a worker only once, so each mount gets a fresh one.
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    canvas.className = "screen";
    canvas.setAttribute("aria-label", "Game preview");
    // Focusing it hands the arrows, Space and Z to the game; Tab leaves.
    canvas.setAttribute("role", "application");
    canvas.setAttribute("aria-roledescription", "game");
    canvas.setAttribute("aria-describedby", "emu-hint");
    emuContainer.current!.replaceChildren(canvas);
    const emu = new WorkerEmulator(canvas);
    emulator.current = emu;
    window.__cs.emulator = emu;
    return () => {
      s.dispose();
      emu.dispose();
      emulator.current = null;
    };
  }, []);

  // Rebuild 300 ms after the last change. A newer build cancels an older one.
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(async () => {
      setBuilding(true);
      const t0 = performance.now();
      // Previews skip signing: it's most of the build time and emulators don't check it.
      const r = await service.current!.build(source, { sign: false });
      if (r.kind === "cancelled") return;
      const rec: BuildRecord = {
        n: ++counter.current,
        kind: r.kind,
        cached: r.kind === "built" && r.cached,
        wallMs: performance.now() - t0,
        generateMs: r.generateMs,
        buildMs: r.buildMs,
      };
      console.info(
        `[build #${rec.n}] ${r.kind}${rec.cached ? " (cached)" : ""} in ${rec.wallMs.toFixed(1)} ms ` +
          `(generate ${r.generateMs.toFixed(1)}, toolchain ${r.buildMs.toFixed(1)})`,
      );
      if (r.kind === "built") {
        // Report "up to date" only once the preview is running the new ROM.
        try {
          await emulator.current?.load(r.a78, "a78");
        } catch (e) {
          setError(`The game couldn't start (${String(e)}). Press Restart, or reload the page; your work is saved.`);
        }
        setLastGood(r);
      } else if (r.kind === "failed") {
        console.error(`[build] ${r.stage}: ${r.message}\n${r.log}`);
      }
      window.__cs!.builds.unshift(rec);
      window.__cs!.last = r;
      setRecord(rec);
      setResult(r);
      setBuilding(false);
    }, BUILD_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [source, ready]);

  /** A signed build of the current game, on its own worker so the preview isn't cancelled. */
  const buildSigned = async (): Promise<{ a78: Uint8Array; bin: Uint8Array }> => {
    const exporter = new WorkerBuildService();
    try {
      const r = await exporter.build(sourceRef.current, { sign: true });
      if (r.kind === "built" && r.signed) return { a78: r.a78, bin: r.bin };
      if (r.kind === "invalid") throw new Error(r.errors.join(" "));
      throw new Error("We couldn't make the download; your work is saved. Try again, or reload the page.");
    } finally {
      exporter.dispose();
    }
  };

  const screenshot = async (): Promise<Screenshot | undefined> => {
    const emu = emulator.current;
    if (!emu || !lastGood) return undefined;
    return { width: 320, height: 240, rgba: await emu.readPixels(0, 0, 320, 240) };
  };

  const status = !ready
    ? "Starting the game builder…"
    : building
      ? "Building…"
      : result?.kind === "built"
        ? "Up to date"
        : result?.kind === "invalid"
          ? "Needs a fix: see below"
          : result?.kind === "failed"
            ? "We couldn't build this game; your work is saved. See below for what to do."
            : "";

  const timing = record
    ? `Last build ${record.wallMs.toFixed(0)} ms${record.cached ? " (cached)" : ""}` +
      ` · generate ${record.generateMs.toFixed(1)} ms · toolchain ${record.buildMs.toFixed(1)} ms` +
      (ready ? ` · ${ready.toolchainVersion}` : "")
    : "";

  /** TV mode: the game full screen with its title and a controller prompt, ready to play. */
  const enterTv = () => {
    const el = stage.current;
    if (!el) return;
    void el.requestFullscreen?.().catch(() => {});
    el.querySelector("canvas")?.focus();
  };

  return { emuContainer, stage, enterTv, emulator, ready, result, lastGood, status, timing, error, setError, buildSigned, screenshot };
}

export type Preview = ReturnType<typeof usePreview>;
