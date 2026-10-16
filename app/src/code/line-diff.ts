// Which lines of the new generated code differ from the last build's, so
// the code view can show what an edit changed. A plain LCS over lines, after
// trimming the common start and end; big rewrites fall back to one range.

import type { LineRange } from "./BasicEditor.tsx";

const MAX_CELLS = 2_000_000;

/** Lines (1-based, inclusive ranges) of `next` that are new or changed since `prev`. */
export function changedLines(prev: string, next: string): LineRange[] {
  if (prev === next) return [];
  const a = prev.split("\n");
  const b = next.split("\n");
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  if (endB === start) return []; // only removals
  const n = endA - start;
  const m = endB - start;
  if (n * m > MAX_CELLS) return [{ from: start + 1, to: endB }];

  // lcs[i][j]: LCS length of a[start+i..endA) and b[start+j..endB).
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] = a[start + i] === b[start + j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const changed: number[] = [];
  let i = 0;
  let j = 0;
  while (j < m) {
    if (i < n && a[start + i] === b[start + j]) {
      i++;
      j++;
    } else if (i < n && lcs[i + 1]![j]! >= lcs[i]![j + 1]!) i++;
    else changed.push(start + j++ + 1);
  }
  const ranges: LineRange[] = [];
  for (const line of changed) {
    const last = ranges.at(-1);
    if (last && last.to + 1 === line) last.to = line;
    else ranges.push({ from: line, to: line });
  }
  return ranges;
}
