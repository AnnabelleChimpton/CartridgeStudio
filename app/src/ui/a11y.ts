// Keyboard patterns shared by the editors: arrow keys inside radio groups,
// tab lists and listboxes (one Tab stop per group), and a keyboard cursor
// for the pixel and room grids.

import { useRef, useState } from "react";
import { paint } from "./tokens.ts";

/** Props for one item in a roving-tabindex group: only the chosen one is a Tab stop. */
export const radioProps = (checked: boolean) =>
  ({ role: "radio", "aria-checked": checked, tabIndex: checked ? 0 : -1 }) as const;

export const tabProps = (selected: boolean) =>
  ({ role: "tab", "aria-selected": selected, tabIndex: selected ? 0 : -1 }) as const;

/**
 * Arrow keys, Home and End move between the group's items. With `select`,
 * moving also chooses (radio groups and tabs); without it, only focus moves
 * and Enter or Space chooses (listboxes). `columns` lays the items out as a
 * grid, so Up and Down jump a row.
 */
export function arrowKeys(role: "radio" | "tab" | "option", { select = true, columns = 0 } = {}) {
  return (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>(`[role="${role}"]`)];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    const n = items.length;
    const row = columns || 1;
    let next: number;
    switch (e.key) {
      case "ArrowRight":
        next = (i + 1) % n;
        break;
      case "ArrowLeft":
        next = (i - 1 + n) % n;
        break;
      case "ArrowDown":
        next = columns ? Math.min(n - 1, i + row) : (i + 1) % n;
        break;
      case "ArrowUp":
        next = columns ? Math.max(0, i - row) : (i - 1 + n) % n;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = n - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    items[next]!.focus();
    if (select) items[next]!.click();
  };
}

let keyStroke = 0;

export interface GridKeyboard {
  cols: number;
  rows: number;
  /** Paints one cell; `line` is true while Shift+arrows draw. Calls with the same key are one undo step. */
  paint: (col: number, row: number, erase: boolean, key: string, line: boolean) => void;
  /** Spoken after each move or paint, e.g. "Column 3, row 5: Wall". */
  describe: (col: number, row: number) => string;
  /** Other keys the grid handles (e.g. digits choosing a color); returns true if it used the key. */
  onOtherKey?: (key: string) => boolean;
}

/**
 * A keyboard cursor for a canvas grid. Arrows move it; Space or Enter paints;
 * Delete or Backspace erases; Shift+arrows paint as they go (one undo step
 * until Shift is let go).
 */
export function useGridKeyboard({ cols, rows, paint, describe, onOtherKey }: GridKeyboard) {
  const [pos, setPos] = useState<[number, number]>([0, 0]);
  const [focused, setFocused] = useState(false);
  const line = useRef<string | null>(null);
  const col = Math.min(pos[0], cols - 1);
  const row = Math.min(pos[1], rows - 1);

  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const step: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const d = step[e.key];
    if (d) {
      e.preventDefault();
      const nc = Math.min(cols - 1, Math.max(0, col + d[0]));
      const nr = Math.min(rows - 1, Math.max(0, row + d[1]));
      if (e.shiftKey) {
        if (!line.current) {
          line.current = `keys:${++keyStroke}`;
          paint(col, row, false, line.current, true);
        }
        paint(nc, nr, false, line.current, true);
      }
      setPos([nc, nr]);
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      paint(col, row, false, `keys:${++keyStroke}`, false);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      paint(col, row, true, `keys:${++keyStroke}`, false);
    } else if (onOtherKey?.(e.key)) {
      e.preventDefault();
    }
  };

  const onKeyUp = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "Shift") line.current = null;
  };

  return {
    cursor: focused ? ([col, row] as const) : null,
    /** Moves the cursor to where the mouse painted, so the keyboard carries on from there. */
    moveTo: (c: number, r: number) => setPos([c, r]),
    props: {
      tabIndex: 0,
      role: "application",
      onKeyDown,
      onKeyUp,
      onFocus: () => setFocused(true),
      onBlur: () => {
        setFocused(false);
        line.current = null;
      },
    },
    /** Text for a polite live region next to the grid. */
    announcement: focused ? describe(col, row) : "",
  };
}

/** Outlines the keyboard cursor's cell: dark inside light, so it shows on any color. */
export function drawCursor(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.lineWidth = 2;
  if (w > 8 && h > 8) {
    ctx.strokeStyle = paint("mat");
    ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
  }
  ctx.strokeStyle = paint("text");
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}
