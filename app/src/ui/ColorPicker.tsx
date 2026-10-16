// A swatch that opens the 7800's 256-value palette (16 hues × 16 lumas).

import { useEffect, useRef, useState } from "react";
import { arrowKeys } from "./a11y.ts";
import { ntscCss, toColor } from "./ntsc.ts";

interface Props {
  value: string;
  label: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, label, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const shut = () => {
    setOpen(false);
    button.current?.focus();
  };

  // Opening moves focus to the current color, so arrows work straight away.
  useEffect(() => {
    const grid = ref.current;
    if (open) (grid?.querySelector<HTMLElement>('[aria-selected="true"]') ?? grid?.querySelector<HTMLElement>('[role="option"]'))?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && shut();
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div className="picker" ref={ref}>
      <button
        ref={button}
        type="button"
        className="swatch"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${value}`}
        title={`${label}: ${value}`}
        style={{ background: ntscCss(value) }}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <div
          className="picker-grid"
          role="listbox"
          aria-label={`Choose ${label}`}
          onKeyDown={arrowKeys("option", { select: false, columns: 16 })}
          onBlur={(e) => !ref.current?.contains(e.relatedTarget as Node) && setOpen(false)}
        >
          {Array.from({ length: 256 }, (_, i) => {
            const c = toColor(i);
            return (
              <button
                key={c}
                type="button"
                role="option"
                aria-selected={c === value.toUpperCase()}
                tabIndex={c === value.toUpperCase() ? 0 : -1}
                aria-label={c}
                title={c}
                className={c === value.toUpperCase() ? "selected" : undefined}
                style={{ background: ntscCss(c) }}
                onClick={() => {
                  onChange(c);
                  shut();
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
