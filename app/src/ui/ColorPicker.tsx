// A swatch that opens the 7800's 256-value palette (16 hues × 16 lumas).

import { useEffect, useRef, useState } from "react";
import { ntscCss, toColor } from "./ntsc.ts";

interface Props {
  value: string;
  label: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, label, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
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
        type="button"
        className="swatch"
        aria-label={`${label}: ${value}`}
        title={`${label}: ${value}`}
        style={{ background: ntscCss(value) }}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <div className="picker-grid" role="listbox" aria-label={`Choose ${label}`}>
          {Array.from({ length: 256 }, (_, i) => {
            const c = toColor(i);
            return (
              <button
                key={c}
                type="button"
                role="option"
                aria-selected={c === value.toUpperCase()}
                aria-label={c}
                title={c}
                className={c === value.toUpperCase() ? "selected" : undefined}
                style={{ background: ntscCss(c) }}
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
