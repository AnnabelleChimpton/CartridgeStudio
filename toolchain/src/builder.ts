// The compiler sits behind this interface so the in-browser WASI build can be
// swapped for the server-side fallback (SPEC.md, "Fallback if the spike fails")
// without touching callers.

export interface BuildInput {
  /** 7800basic source. */
  source: string;
  /** Extra files next to the source, e.g. `face.png` for `incgraphic face.png`. */
  files?: Record<string, Uint8Array>;
  /** Run 7800optimize between postprocess and dasm. */
  optimize?: boolean;
}

export interface StageTiming {
  stage: string;
  ms: number;
}

export interface BuildSuccess {
  ok: true;
  /** ROM with a 128-byte A78 header, for emulators and flash carts. */
  a78: Uint8Array;
  /** Signed raw ROM that passes the NTSC console's cartridge check. */
  bin: Uint8Array;
  /** dasm symbol table, for reading RAM addresses in tests. */
  symbols: string;
  log: string;
  timings: StageTiming[];
  totalMs: number;
  toolchainVersion: string;
}

export interface BuildFailure {
  ok: false;
  stage: string;
  message: string;
  log: string;
  timings: StageTiming[];
  totalMs: number;
  toolchainVersion: string;
}

export type BuildResult = BuildSuccess | BuildFailure;

export interface Builder {
  readonly toolchainVersion: string;
  build(input: BuildInput): Promise<BuildResult>;
}
