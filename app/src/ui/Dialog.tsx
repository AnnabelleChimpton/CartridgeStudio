// A modal dialog on the native <dialog> element: focus moves in and is kept
// there, Escape closes it, and focus returns to what opened it.

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "./Icon.tsx";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  /** Where focus goes on close. Defaults to whatever had focus on open (Safari doesn't focus clicked buttons, so pass the opener). */
  returnTo?: HTMLElement | null;
}

export function Dialog({ title, onClose, children, wide, returnTo }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current!;
    const opener = returnTo ?? (document.activeElement as HTMLElement | null);
    d.showModal();
    return () => {
      d.close();
      opener?.focus();
    };
    // Opened once per mount; the opener is fixed by then.
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? "wide" : ""}`}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="dialog-head">
        <h2 id={id}>{title}</h2>
        <button type="button" className="icon" aria-label="Close" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
