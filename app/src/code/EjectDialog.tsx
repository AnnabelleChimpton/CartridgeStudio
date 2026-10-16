// Confirms ejecting a game into a code project: what it means, that it's one
// way, and that the original stays.

import { Dialog } from "../ui/Dialog.tsx";

interface Props {
  title: string;
  /** "kit game", for the copy. */
  kind: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function EjectDialog({ title, kind, onConfirm, onClose }: Props) {
  return (
    <Dialog title={`Edit “${title || "this game"}” as code?`} onClose={onClose}>
      <p>
        This makes a <strong>code project</strong>: a copy of the game as 7800basic source (game.bas) plus its graphics, which you edit by
        hand, with the same live preview.
      </p>
      <p>
        <strong>It's one way.</strong> Changes to the code can't come back into this editor, and the no-code tabs don't
        apply to code. Your {kind} is kept as it is in My games, and you can go back to it from the code editor.
      </p>
      <div className="toolbar">
        <button type="button" onClick={onConfirm}>
          Make a code project
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Dialog>
  );
}
