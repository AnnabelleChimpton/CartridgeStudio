// Reads the toolchain's report: errors and warnings mapped to game.bas lines,
// and how much ROM space is left. 7800basic reports `*** ERROR  line N: …`;
// dasm reports assembly lines, which 7800filter traces back with "The likely
// source is line N in your basic source code". dasm errors it can't trace
// (in the generated headers, say) are kept without a line.

export interface BuildProblem {
  severity: "error" | "warning";
  /** 1-based line in game.bas, when the toolchain says. */
  line?: number;
  message: string;
  /** Which tool said it. */
  tool: "7800basic" | "dasm" | "toolchain";
}

const BASIC = /^\*\*\* (ERROR|WARNING)\s+line (\d+)(?: \([^)]*\))?:\s*(.*)$/;
const DEFINE = /^\((\d+)\) ERROR: (.*)$/;
const DASM = /^(\S+) \((\d+)\): error: (.*)$/;
const TRACE = /The likely source is line (\d+) in your basic source code/;
const OTHER = /^(?:\*\*\*|#+) ERROR:?\s*(.*)$/;
const FATAL = /^(Fatal assembly error: .*|Unrecoverable error\(s\) in pass.*)$/;

const tidy = (m: string) => m.trim().replace(/\.$/, "");

export function parseBuildLog(log: string): BuildProblem[] {
  const lines = log.split(/\r?\n/);
  const out: BuildProblem[] = [];
  const seen = new Set<string>();
  const add = (p: BuildProblem) => {
    const key = `${p.severity}|${p.line ?? ""}|${p.message}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(p);
  };
  let fatal: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!.trimEnd();
    let m: RegExpMatchArray | null;
    if ((m = l.match(BASIC))) {
      add({ severity: m[1] === "ERROR" ? "error" : "warning", line: Number(m[2]), message: tidy(m[3]!), tool: "7800basic" });
    } else if ((m = l.match(DEFINE))) {
      add({ severity: "error", line: Number(m[1]), message: tidy(m[2]!), tool: "7800basic" });
    } else if ((m = l.match(DASM))) {
      const trace = lines[i + 1]?.match(TRACE);
      const message = tidy(m[3]!);
      if (trace) {
        add({ severity: "error", line: Number(trace[1]), message: message.replace(/'jmp \.(\w+)'/, "'$1' (no such label?)"), tool: "dasm" });
        i += 2; // the trace and the echoed source line
      } else {
        add({ severity: "error", message: `${message} (in ${m[1]}, line ${m[2]})`, tool: "dasm" });
      }
    } else if ((m = l.match(FATAL))) {
      fatal ??= tidy(m[1]!);
    } else if ((m = l.match(OTHER))) {
      add({ severity: "error", message: tidy(m[1]!), tool: "toolchain" });
    }
  }
  if (fatal && !out.some((p) => p.severity === "error")) add({ severity: "error", message: fatal, tool: "dasm" });
  return out;
}

export interface RomSpace {
  /** Bytes free in each ROM area dasm reports ("the main area", "bank 2"…). Negative means over. */
  areas: { name: string; bytes: number }[];
  /** Bytes free in each graphics block. */
  graphics: { block: number; bytes: number }[];
}

export function romSpace(log: string): RomSpace {
  const areas = [...log.matchAll(/(-?\d+) bytes of ROM space left in ([^.\n]+)/g)].map((m) => ({ name: m[2]!.trim(), bytes: Number(m[1]) }));
  const graphics = [...log.matchAll(/GFX block #(\d+) has (-?\d+) bytes left/g)].map((m) => ({ block: Number(m[1]), bytes: Number(m[2]) }));
  return { areas, graphics };
}
