// Which generated lines the last edit changed: compares each new build's
// game.bas with the one before it.

import { useEffect, useRef, useState } from "react";
import type { LineRange } from "./BasicEditor.tsx";
import { changedLines } from "./line-diff.ts";

export function useGeneratedDiff(source: string | undefined): LineRange[] {
  const previous = useRef<string | undefined>(undefined);
  const [changed, setChanged] = useState<LineRange[]>([]);
  useEffect(() => {
    if (source === undefined) return;
    if (previous.current !== undefined && previous.current !== source) setChanged(changedLines(previous.current, source));
    previous.current = source;
  }, [source]);
  return changed;
}
