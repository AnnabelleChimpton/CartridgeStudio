// "See the code" for kit and template games: the generated game.bas,
// read-only, with the lines for whatever is selected in the editor marked.
// One click from there makes it a code project.

import { useId, useMemo, useState } from "react";
import { LazyBasicEditor } from "./LazyBasicEditor.tsx";
import { markedLines, type CodeRef } from "./markers.ts";

interface Props {
  source: string | undefined;
  /** What's selected in the editor, and how to name it; leave out where nothing maps to lines. */
  selection?: { ref: CodeRef; name: string } | null;
  onEject?: () => void;
}

const describe = (ranges: { from: number; to: number }[]) =>
  ranges.map((r) => (r.from === r.to ? `line ${r.from}` : `lines ${r.from}–${r.to}`)).join(", ");

export function SeeTheCode({ source, selection, onEject }: Props) {
  const [open, setOpen] = useState(false);
  const ids = useId();
  const ranges = useMemo(() => (source && selection ? markedLines(source, selection.ref) : []), [source, selection]);
  const caption =
    selection === undefined
      ? "The 7800basic program this game becomes, as Cartridge Studio generated it."
      : !selection
        ? "Select a thing or a rule to find the code it becomes."
        : ranges.length
          ? `${selection.name}: ${describe(ranges)}.`
          : `${selection.name} has no code of its own in this build.`;

  return (
    <details className="code see-code" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>See the code</summary>
      {open && (
        <>
          <p className="muted small" id={`${ids}-caption`} aria-live="polite">
            {caption}
          </p>
          <LazyBasicEditor
            value={source ?? ""}
            readOnly
            label="game.bas, as generated (read-only)"
            describedBy={`${ids}-caption`}
            highlight={ranges}
            testId="game-bas"
          />
          {onEject && (
            <div className="toolbar">
              <button type="button" className="secondary" onClick={onEject}>
                Edit as code…
              </button>
              <span className="muted small">Make a copy you write in 7800basic.</span>
            </div>
          )}
        </>
      )}
    </details>
  );
}
