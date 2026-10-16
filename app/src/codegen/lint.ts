// Checks generated 7800basic for constructs that break 7800basic 0.41
// (templates/README.md, "pitfalls"). A hit is a template bug, so generation
// stops instead of handing the compiler code that hangs it or misbehaves.

export interface LintIssue {
  line: number;
  message: string;
}

const CALL_POSITIONS: Record<string, number[]> = {
  // plotsprite gfx palette x y [frame]: x and y are positions 2 and 3
  plotsprite: [2, 3],
};

export function lintBasic(source: string): LintIssue[] {
  const lines = source.split("\n");
  const consts = new Set<string>();
  const constValues = new Map<string, string>();
  for (const l of lines) {
    const m = /^\s*const\s+([A-Za-z_]\w*)\s*=\s*(\S+)/.exec(l);
    if (m) {
      consts.add(m[1]!);
      constValues.set(m[1]!, m[2]!);
    }
  }

  const issues: LintIssue[] = [];
  lines.forEach((raw, i) => {
    const line = raw.replace(/^\s*rem\b.*$/, "");
    const n = i + 1;

    for (const m of line.matchAll(/\*\s*([A-Za-z_]\w*)/g)) {
      if (consts.has(m[1]!)) issues.push({ line: n, message: `multiplies by const ${m[1]} (hangs the compiler)` });
    }

    for (const m of line.matchAll(/\bscore\d\s*=\s*score\d\s*[-+]\s*([A-Za-z_]\w*)/g)) {
      const value = constValues.get(m[1]!);
      if (value !== undefined && !value.startsWith("$")) {
        issues.push({ line: n, message: `score math uses const ${m[1]} = ${value}, which isn't written as BCD ($..)` });
      }
    }

    for (const [cmd, positions] of Object.entries(CALL_POSITIONS)) {
      for (const m of line.matchAll(new RegExp(`\\b${cmd}\\s+([^:]+)`, "g"))) {
        const args = m[1]!.trim().split(/\s+/);
        for (const p of positions) {
          if (args[p] && consts.has(args[p]!)) {
            issues.push({ line: n, message: `${cmd} uses const ${args[p]} as a position (read as an address)` });
          }
        }
      }
    }

    for (const m of line.matchAll(/boxcollision\s*\(([^)]*)\)/g)) {
      const args = m[1]!.split(",").map((a) => a.trim());
      for (const p of [0, 1, 4, 5]) {
        if (args[p] && consts.has(args[p]!)) {
          issues.push({ line: n, message: `boxcollision uses const ${args[p]} as a position (read as an address)` });
        }
      }
    }
  });
  return issues;
}
