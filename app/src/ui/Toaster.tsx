// Short confirmations that slide up and leave on their own: "Saved", "Downloaded".
// Call toast() from anywhere; <Toaster /> is mounted by the top bar. The region
// is always in the page so screen readers announce new messages politely.

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon.tsx";

interface Toast {
  id: number;
  message: string;
  kind: "ok" | "error";
}

const SHOW_MS = 4000;
let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(message: string, kind: Toast["kind"] = "ok") {
  const id = nextId++;
  // Three at most: the newest replace the oldest.
  toasts = [...toasts.slice(-2), { id, message, kind }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, SHOW_MS);
}

export function Toaster() {
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    () => toasts,
  );
  // In <body>, so no ancestor's filter or transform can move it.
  return createPortal(
    <div className="toaster" role="status" aria-live="polite">
      {list.map((t) => (
        <p key={t.id} className={`toast ${t.kind}`}>
          <span className="toast-icon">
            <Icon name={t.kind === "ok" ? "check" : "close"} size={16} />
          </span>
          {t.message}
        </p>
      ))}
    </div>,
    document.body,
  );
}
