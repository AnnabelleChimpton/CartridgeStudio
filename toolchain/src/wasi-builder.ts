// Runs the unmodified 7800basic WebAssembly tools under an in-memory WASI shim.
// This replaces the 7800basic.sh script: same stages, same arguments, but every
// file lives in a Map instead of on disk. Works in a Web Worker and in Node.

import {
  ConsoleStdout,
  Directory,
  File,
  OpenFile,
  PreopenDirectory,
  WASI,
  type Inode,
} from "@bjorn3/browser_wasi_shim";
import type { BuildInput, BuildResult, Builder, StageTiming } from "./builder.ts";
import type { ToolchainPack } from "./pack.ts";

/** Where the toolchain directory is mounted inside the WASI filesystem. */
const TOOL_DIR = "/7800basic";
const SOURCE = "game.bas";

const REQUIRED_TOOLS = [
  "7800preprocess",
  "7800basic",
  "7800postprocess",
  "7800optimize",
  "dasm",
  "7800filter",
  "7800sign",
  "7800header",
] as const;
type Tool = (typeof REQUIRED_TOOLS)[number];

interface RunResult {
  code: number;
  stdout: Uint8Array;
  stderr: string;
}

class StageError extends Error {
  readonly stage: string;
  constructor(stage: string, message: string) {
    super(message);
    this.stage = stage;
  }
}

const decoder = new TextDecoder();
const encoder = new TextEncoder();

export class WasiBuilder implements Builder {
  readonly toolchainVersion: string;
  private readonly modules: Map<Tool, WebAssembly.Module>;
  private readonly toolDirContents: Map<string, Inode>;

  private constructor(
    toolchainVersion: string,
    modules: Map<Tool, WebAssembly.Module>,
    toolDirContents: Map<string, Inode>,
  ) {
    this.toolchainVersion = toolchainVersion;
    this.modules = modules;
    this.toolDirContents = toolDirContents;
  }

  /** Compiles every tool once; the compiled modules are reused for each build. */
  static async create(pack: ToolchainPack): Promise<WasiBuilder> {
    const modules = new Map<Tool, WebAssembly.Module>();
    await Promise.all(
      REQUIRED_TOOLS.map(async (tool) => {
        const bytes = pack.files.get(`${tool}.wasm`);
        if (!bytes) throw new Error(`Toolchain pack is missing ${tool}.wasm`);
        modules.set(tool, await WebAssembly.compile(bytes as Uint8Array<ArrayBuffer>));
      }),
    );

    const includes = new Map<string, Inode>();
    for (const [path, data] of pack.files) {
      if (path.startsWith("includes/")) {
        includes.set(path.slice("includes/".length), new File(data, { readonly: true }));
      }
    }
    const toolDir = new Map<string, Inode>([["includes", new Directory(includes)]]);

    return new WasiBuilder(`${pack.name} ${pack.version}`, modules, toolDir);
  }

  async build(input: BuildInput): Promise<BuildResult> {
    const started = performance.now();
    const timings: StageTiming[] = [];
    let log = "";

    // The project directory, shared by every stage like the shell's cwd.
    const cwd = new Map<string, Inode>();
    cwd.set(SOURCE, new File(encoder.encode(input.source)));
    for (const [name, data] of Object.entries(input.files ?? {})) {
      cwd.set(name, new File(data));
    }

    const run = async (tool: Tool, args: string[], stdin?: Uint8Array): Promise<RunResult> => {
      const t0 = performance.now();
      const stdoutChunks: Uint8Array[] = [];
      let stderr = "";
      const fds = [
        new OpenFile(new File(stdin ?? new Uint8Array())),
        new ConsoleStdout((b) => stdoutChunks.push(b.slice())),
        new ConsoleStdout((b) => (stderr += decoder.decode(b, { stream: true }))),
        new PreopenDirectory(".", cwd),
        new PreopenDirectory(TOOL_DIR, this.toolDirContents),
      ];
      const wasi = new WASI([tool, ...args], [], fds, { debug: false });
      const instance = await WebAssembly.instantiate(this.modules.get(tool)!, {
        wasi_snapshot_preview1: wasi.wasiImport,
      });
      const code = wasi.start(instance as Parameters<WASI["start"]>[0]);
      const stdout = concat(stdoutChunks);
      timings.push({ stage: tool, ms: performance.now() - t0 });
      log += `$ ${tool} ${args.join(" ")}\n${stderr}`;
      return { code, stdout, stderr };
    };

    const readFile = (name: string, stage: string): Uint8Array => {
      const f = cwd.get(name);
      if (!(f instanceof File)) throw new StageError(stage, `${stage} did not produce ${name}`);
      return f.data;
    };

    try {
      // 1. Preprocess: source on stdin, tokenized BASIC on stdout.
      const pre = await run("7800preprocess", [], encoder.encode(input.source));
      if (pre.code !== 0) throw new StageError("7800preprocess", `exit code ${pre.code}`);
      cwd.set(`${SOURCE}.pre`, new File(pre.stdout));

      // 2. Compile: writes 7800.asm, includes.7800, a78info.cfg and friends into cwd.
      const bas = await run("7800basic", ["-i", TOOL_DIR, "-b", SOURCE, "-p", `${SOURCE}.pre`]);
      log += decoder.decode(bas.stdout);
      if (bas.code !== 0) throw new StageError("7800basic", `exit code ${bas.code}`);
      cwd.delete(`${SOURCE}.pre`);

      // 3. Post-process (and optionally optimize) into the final assembly.
      const post = await run("7800postprocess", ["-i", TOOL_DIR]);
      if (post.code !== 0) throw new StageError("7800postprocess", `exit code ${post.code}`);
      let asm = post.stdout;
      if (input.optimize) {
        const opt = await run("7800optimize", [], asm);
        if (opt.code !== 0) throw new StageError("7800optimize", `exit code ${opt.code}`);
        asm = opt.stdout;
      }
      cwd.set(`${SOURCE}.asm`, new File(asm));

      if (cwd.has("banksetrom.asm")) {
        throw new StageError("7800basic", "bankset ROMs are not supported");
      }

      // 4. Assemble. dasm's report goes through 7800filter, as in 7800basic.sh.
      const dasm = await run("dasm", [
        `${SOURCE}.asm`,
        `-I${TOOL_DIR}/includes`,
        "-f3",
        "-p20",
        `-s${SOURCE}.symbol.txt`,
        `-o${SOURCE}.bin`,
        ...(input.listing ? [`-l${SOURCE}.list.txt`] : []),
      ]);
      const filtered = await run("7800filter", [], dasm.stdout);
      log += decoder.decode(filtered.stdout);
      if (dasm.code !== 0) throw new StageError("dasm", `exit code ${dasm.code}`);

      // 5. Sign the raw image in place (unless asked not to), then write the .a78 with its header.
      const signed = input.sign ?? true;
      if (signed) {
        const sign = await run("7800sign", ["-w", `${SOURCE}.bin`]);
        log += decoder.decode(sign.stdout);
        if (sign.code !== 0) throw new StageError("7800sign", `exit code ${sign.code}`);
      }

      const header = await run("7800header", ["-o", "-f", "a78info.cfg", `${SOURCE}.bin`]);
      log += decoder.decode(header.stdout);
      if (header.code !== 0) throw new StageError("7800header", `exit code ${header.code}`);

      return {
        ok: true,
        bin: readFile(`${SOURCE}.bin`, "dasm"),
        signed,
        a78: readFile(`${SOURCE}.a78`, "7800header"),
        symbols: decoder.decode(readFile(`${SOURCE}.symbol.txt`, "dasm")),
        ...(input.listing ? { listing: decoder.decode(readFile(`${SOURCE}.list.txt`, "dasm")) } : {}),
        log,
        timings,
        totalMs: performance.now() - started,
        toolchainVersion: this.toolchainVersion,
      };
    } catch (e) {
      return {
        ok: false,
        stage: e instanceof StageError ? e.stage : "internal",
        message: e instanceof Error ? e.message : String(e),
        log,
        timings,
        totalMs: performance.now() - started,
        toolchainVersion: this.toolchainVersion,
      };
    }
  }
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}
