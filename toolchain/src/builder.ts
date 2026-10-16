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
  /**
   * Sign the ROM so it passes the NTSC console's cartridge check (default true).
   * Signing is most of a build's time and emulators don't check it, so
   * previews can skip it. Anything a creator downloads must be signed.
   */
  sign?: boolean;
  /** Also ask dasm for its assembly listing (`-l`). It's large, so only on request. */
  listing?: boolean;
}

export interface StageTiming {
  stage: string;
  ms: number;
}

export interface BuildSuccess {
  ok: true;
  /** ROM with a 128-byte A78 header, for emulators and flash carts. */
  a78: Uint8Array;
  /** Raw ROM; passes the NTSC console's cartridge check only when `signed`. */
  bin: Uint8Array;
  signed: boolean;
  /** dasm symbol table, for reading RAM addresses in tests. */
  symbols: string;
  /** dasm's assembly listing, when `listing` was asked for. */
  listing?: string;
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
