// Gentle notes when a color may be hard to see on the game's background, each
// with a one-click fix. They never stop a build.

import { ntscCss } from "../ui/ntsc.ts";
import { contrastFix, contrastMessage, type ContrastWarning } from "./contrast.ts";
import { useKitStore } from "./store.ts";

export function ContrastNotes({ warnings, id }: { warnings: ContrastWarning[]; id: string }) {
  const background = useKitStore((s) => s.project.background);
  const edit = useKitStore((s) => s.edit);
  // The region is always there, so a note that appears is read out.
  return (
    <div className="contrast-notes" aria-live="polite" data-testid={id}>
      {warnings.map((w) => (
        <p key={w.id} className="contrast-note" data-testid={`contrast-${w.id}`}>
          <span>{contrastMessage(w, background)}</span>{" "}
          <button
            type="button"
            className="link"
            onClick={() => edit((d) => void (d.palettes.find((p) => p.id === w.slot.palette)!.colors[w.slot.index] = w.suggestion))}
          >
            <span className="picker-chip" style={{ background: ntscCss(w.suggestion) }} aria-hidden="true" /> {contrastFix(w, background)}
          </button>
        </p>
      ))}
    </div>
  );
}
