// Finds the lines the kit generator wrote for one rule or one thing, from the
// markers it leaves in game.bas: `rem rule N: …` and the r<N-1>_… labels for
// a rule, `rem <label>` (and `rem <label> frame 2`) for a thing's graphics and
// draw routine, `rem palette <id>` for its colors. Reading the output keeps
// this independent of the generator's internals.

/** What the kit editor has selected. Rules count from 1, as the markers do. */
export type CodeRef = { rule: number } | { thing: string; palette?: string };

interface Segment {
  /** 1-based, inclusive. */
  from: number;
  to: number;
  marker: string;
}

/** Splits the source at labels, `rem` markers and blank lines; each segment remembers what started it. */
function segments(lines: string[]): Segment[] {
  const out: Segment[] = [];
  let current: Segment | null = null;
  lines.forEach((line, i) => {
    const n = i + 1;
    if (!line.trim()) {
      current = null;
      return;
    }
    const label = /^([A-Za-z_]\w*)\s*$/.exec(line);
    const rem = /^\s+rem\s+(.*)$/i.exec(line);
    // A rem right under a label names the label's block (`draw0` / `rem Cat`).
    if (rem && current && current.to === n - 1 && current.from === n - 1 && /^label:/.test(current.marker)) {
      current.marker = `rem:${rem[1]!.trim()}`;
      current.to = n;
      return;
    }
    if (label || rem) {
      current = { from: n, to: n, marker: label ? `label:${label[1]}` : `rem:${rem![1]!.trim()}` };
      out.push(current);
      return;
    }
    if (current) current.to = n;
    else out.push((current = { from: n, to: n, marker: "" }));
  });
  return out;
}

function owns(marker: string, ref: CodeRef): boolean {
  if ("rule" in ref) {
    if (new RegExp(`^rem:rule ${ref.rule}(:|$)`).test(marker)) return true;
    const m = /^label:r(\d+)_\w+$/.exec(marker);
    return !!m && Number(m[1]) === ref.rule - 1;
  }
  if (!marker.startsWith("rem:")) return false;
  const text = marker.slice(4);
  if (text === ref.thing || new RegExp(`^${escape(ref.thing)} frame \\d+$`).test(text)) return true;
  return ref.palette !== undefined && text === `palette ${ref.palette}`;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Line ranges (1-based, inclusive) for `ref`, in order. Empty if the source has no markers for it. */
export function markedLines(source: string, ref: CodeRef): { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = [];
  for (const s of segments(source.split("\n"))) {
    if (!owns(s.marker, ref)) continue;
    const last = ranges.at(-1);
    if (last && last.to + 1 >= s.from) last.to = s.to;
    else ranges.push({ from: s.from, to: s.to });
  }
  return ranges;
}
