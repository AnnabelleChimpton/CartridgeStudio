// Small edits to game.bas the Assets and Reference tabs make for you.

const INCGRAPHIC = /^\s+incgraphic\s+(\S+)/i;

/** Inserts `line` after line `after` (1-based; 0 means at the top). */
export function insertLine(source: string, after: number, line: string): string {
  const lines = source.split("\n");
  lines.splice(after, 0, line);
  return lines.join("\n");
}

/** Where a new incgraphic goes: after `afterFile`'s import if given, else after the last import, else after displaymode or the opening comments. */
export function incgraphicSpot(source: string, afterFile?: string): number {
  const lines = source.split("\n");
  const imports = lines.map((l, i) => [INCGRAPHIC.exec(l)?.[1], i] as const).filter(([f]) => f);
  if (afterFile) {
    const own = imports.filter(([f]) => f!.toLowerCase() === afterFile.toLowerCase()).at(-1);
    if (own) return own[1] + 1;
  }
  if (imports.length) return imports.at(-1)![1] + 1;
  const mode = lines.findIndex((l) => /^\s+displaymode\b/i.test(l));
  if (mode >= 0) return mode + 1;
  let i = 0;
  while (i < lines.length && /^\s+rem\b/i.test(lines[i]!)) i++;
  return i;
}

export function addIncgraphic(source: string, file: string, afterFile?: string): { source: string; line: number } {
  const at = incgraphicSpot(source, afterFile);
  return { source: insertLine(source, at, ` incgraphic ${file} 160A 0 1 2 3`), line: at + 1 };
}

/** Drops the incgraphic lines that import `file`. */
export function removeIncgraphic(source: string, file: string): string {
  return source
    .split("\n")
    .filter((l) => INCGRAPHIC.exec(l)?.[1]?.toLowerCase() !== file.toLowerCase())
    .join("\n");
}

/** Inserts a snippet on the line after the cursor's; returns the new source and the snippet's first line (1-based). */
export function insertAfterCursor(source: string, cursor: number, snippet: string): { source: string; line: number } {
  const lineEnd = source.indexOf("\n", Math.min(cursor, source.length));
  const at = lineEnd < 0 ? source.length : lineEnd;
  const line = source.slice(0, at).split("\n").length + 1;
  return { source: `${source.slice(0, at)}\n${snippet}${source.slice(at)}`, line };
}
