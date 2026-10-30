import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { CARTRIDGE_EXTENSION } from "../files/cartridge-file.ts";
import { arrowKeys } from "./a11y.ts";
import { BrandMark, Wordmark } from "./BrandMark.tsx";
import { Icon } from "./Icon.tsx";
import { ContextStrip } from "./ContextStrip.tsx";
import { AboutDialog } from "./About.tsx";
import { TIERS, setTier, useTier } from "./prefs.ts";
import { Toaster } from "./Toaster.tsx";

/** Below this width the Mode switch moves into the Game menu, so the bar stays one row. */
const NARROW = "(max-width: 720px)";

function isTextField(t: EventTarget | null) {
  return (
    t instanceof HTMLTextAreaElement ||
    (t instanceof HTMLInputElement && t.type !== "range" && t.type !== "checkbox") ||
    // The code editor (CodeMirror) keeps its own undo history too.
    (t instanceof HTMLElement && t.isContentEditable)
  );
}

function useNarrow(): boolean {
  return useSyncExternalStore(
    (changed) => {
      if (typeof matchMedia !== "function") return () => {};
      const m = matchMedia(NARROW);
      m.addEventListener("change", changed);
      return () => m.removeEventListener("change", changed);
    },
    () => typeof matchMedia === "function" && matchMedia(NARROW).matches,
  );
}

export interface MenuItem {
  label: string;
  onClick: () => void;
}

interface Props {
  title: string;
  onTitle: (title: string) => void;
  /** No longer shown. */
  kind?: string;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  onOpen: (file: File) => void;
  onSave: () => void;
  onNew: () => void;
  /** Editor-specific entries in the Game menu, after saving. */
  menuItems?: MenuItem[];
  /** No longer shown. */
  extra?: ReactNode;
}

export function TopBar({ title, onTitle, canUndo, canRedo, undo, redo, onOpen, onSave, onNew, menuItems = [] }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [about, setAbout] = useState(false);
  const narrow = useNarrow();

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
      <Brand />
      <div className="title-group">
        <input className="title-input" aria-label="Game title" value={title} maxLength={60} onChange={(e) => onTitle(e.target.value)} />
      </div>
      <div className="topbar-group history">
        <button type="button" className="icon" onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo (⌘Z)">
          <Icon name="undo" />
        </button>
        <button type="button" className="icon" onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo (⇧⌘Z)">
          <Icon name="redo" />
        </button>
      </div>
      <span className="spacer" />
      {!narrow && <ModeSwitch />}
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
      <GameMenu
        items={[
          { label: "New game", onClick: onNew },
          { label: "Open a game file…", onClick: () => fileInput.current?.click() },
          { label: "Save a game file", onClick: onSave },
          ...menuItems,
          { label: "About and licences", onClick: () => setAbout(true) },
        ]}
        modes={narrow}
      />
      {about && <AboutDialog onClose={() => setAbout(false)} returnTo={document.querySelector<HTMLElement>(".topbar .menu-wrap > button")} />}
      <ContextStrip />
      <Toaster />
    </header>
  );
}

export function Brand() {
  return (
    <span className="brand">
      <BrandMark />
      <Wordmark />
    </span>
  );
}

/** Kit · Rules · 7800basic, named by what you touch: what the editor shows by default. */
export function ModeSwitch({ className = "segmented mode-switch", onPick }: { className?: string; onPick?: () => void }) {
  const tier = useTier();
  return (
    <div className={className} role="radiogroup" aria-label="Mode" onKeyDown={arrowKeys("radio")}>
      {TIERS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="radio"
          aria-checked={tier === t.id}
          tabIndex={tier === t.id ? 0 : -1}
          title={t.detail}
          onClick={() => {
            setTier(t.id);
            onPick?.();
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** A disclosure menu of plain buttons: Escape or clicking away closes it. */
function GameMenu({ items, modes }: { items: MenuItem[]; modes: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    wrap.current?.querySelector<HTMLElement>(".menu button")?.focus();
    const away = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  return (
    <div
      className="menu-wrap"
      ref={wrap}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
      // Tabbing away closes it. (Safari moves focus to nothing when a button is clicked: that isn't leaving.)
      onBlur={(e) => e.relatedTarget && !wrap.current?.contains(e.relatedTarget as Node) && setOpen(false)}
    >
      <button ref={trigger} type="button" className="secondary" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        Game
        <Icon name="chevron" />
      </button>
      <div className="menu" id={id} hidden={!open}>
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            className="quiet"
            onClick={() => {
              setOpen(false);
              item.onClick();
            }}
          >
            {item.label}
          </button>
        ))}
        {modes && <ModeSwitch className="menu-modes" onPick={() => setOpen(false)} />}
      </div>
    </div>
  );
}
