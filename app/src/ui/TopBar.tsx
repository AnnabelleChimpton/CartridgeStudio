// The editor's top bar: title, undo/redo, game files and starting a new game.

import { useEffect, useRef, type ReactNode } from "react";
import { CARTRIDGE_EXTENSION } from "../files/cartridge-file.ts";

function isTextField(t: EventTarget | null) {
  return (
    t instanceof HTMLTextAreaElement ||
    (t instanceof HTMLInputElement && t.type !== "range" && t.type !== "checkbox") ||
    // The code editor (CodeMirror) keeps its own undo history too.
    (t instanceof HTMLElement && t.isContentEditable)
  );
}

interface Props {
  title: string;
  onTitle: (title: string) => void;
  kind: string;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  onOpen: (file: File) => void;
  onSave: () => void;
  onNew: () => void;
  /** Editor-specific buttons, before Undo (e.g. the kit's guide). */
  extra?: ReactNode;
}

export function TopBar({ title, onTitle, kind, canUndo, canRedo, undo, redo, onOpen, onSave, onNew, extra }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);

  // Undo / redo shortcuts (text fields keep their own undo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z" || isTextField(e.target)) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return (
    <header className="topbar">
      <h1>Cartridge Studio</h1>
      <input
        className="title-input"
        aria-label="Game title"
        value={title}
        maxLength={60}
        onChange={(e) => onTitle(e.target.value)}
      />
      <span className="muted small">{kind}</span>
      <span className="spacer" />
      {extra}
      <button type="button" className="secondary" onClick={undo} disabled={!canUndo} title="Undo (⌘Z)">
        Undo
      </button>
      <button type="button" className="secondary" onClick={redo} disabled={!canRedo} title="Redo (⇧⌘Z)">
        Redo
      </button>
      <input
        ref={fileInput}
        type="file"
        accept={`${CARTRIDGE_EXTENSION},.json`}
        hidden
        aria-label="Open game file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onOpen(file);
        }}
      />
      <button type="button" className="secondary" title="Open a game you saved with Save game file" onClick={() => fileInput.current?.click()}>
        Open…
      </button>
      <button type="button" className="secondary" title="Keep a copy of your game on this computer, to open again or share" onClick={onSave}>
        Save game file
      </button>
      <button type="button" className="secondary" onClick={onNew}>
        New game
      </button>
    </header>
  );
}
