// The context strip: one line under the top bar for the one thing that
// matters right now. Several parts of the app want that space; it shows a
// single item, by priority: an error, then a guide step, then the jam theme,
// then offline status. See design/DIRECTION.md, Context strip.
//
// Anywhere in the app:
//   useContextItem(failed && { kind: "error", message: "Couldn't open it", onDismiss })
//   <ContextItem kind="guide" message="Step 1 of 3: draw your hero" action={<button …>Next</button>} />
// The strip itself is part of the top bar.

import { useId, useLayoutEffect, useSyncExternalStore, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon.tsx";

export type ContextKind = "error" | "guide" | "jam" | "offline";

export interface ContextItemProps {
  kind: ContextKind;
  message: ReactNode;
  /** One control at the end of the line, e.g. "Next step" or "Read the brief". */
  action?: ReactNode;
  /** Shows a Dismiss button. */
  onDismiss?: () => void;
}

const PRIORITY: ContextKind[] = ["error", "guide", "jam", "offline"];
const ICONS: Record<ContextKind, IconName> = { error: "close", guide: "star", jam: "clip", offline: "system" };

let items = new Map<string, ContextItemProps>();
let top: ContextItemProps | null = null;
const listeners = new Set<() => void>();

function changed() {
  top = [...items.values()].sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind))[0] ?? null;
  listeners.forEach((l) => l());
}

/** Offers an item to the strip while the calling component is mounted. Pass a falsy value for none. */
export function useContextItem(item: ContextItemProps | null | false | undefined | "") {
  const id = useId();
  useLayoutEffect(() => {
    if (item) items = new Map(items).set(id, item);
    else if (items.has(id)) (items = new Map(items)).delete(id);
    else return;
    changed();
  });
  useLayoutEffect(
    () => () => {
      (items = new Map(items)).delete(id);
      changed();
    },
    [id],
  );
}

/** The same as useContextItem, as an element. */
export function ContextItem(props: ContextItemProps) {
  useContextItem(props);
  return null;
}

export function ContextStrip() {
  const item = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    () => top,
  );
  // Errors interrupt; everything else waits its turn. Both regions stay in the
  // page so screen readers hear what is added to them.
  return (
    <div className="context-strip" data-kind={item?.kind}>
      <div role="alert" className="context-line">
        {item?.kind === "error" && <Line item={item} />}
      </div>
      <div role="status" className="context-line">
        {item && item.kind !== "error" && <Line item={item} />}
      </div>
    </div>
  );
}

function Line({ item }: { item: ContextItemProps }) {
  return (
    <p className={`context-item ${item.kind}`}>
      <span className="context-icon">
        <Icon name={ICONS[item.kind]} size={16} />
      </span>
      <span className="context-message">{item.message}</span>
      {item.action}
      {item.onDismiss && (
        <button type="button" className="link" onClick={item.onDismiss}>
          Dismiss
        </button>
      )}
    </p>
  );
}
