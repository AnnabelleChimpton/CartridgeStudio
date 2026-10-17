// Installing and running offline: registers the service worker (pwa/sw.js,
// production builds only), and tracks what the status bar shows: whether
// everything is cached for offline use, whether the network is up, whether a
// newer version is waiting, and whether the browser offers to install the app.

import { useSyncExternalStore } from "react";

/** Chrome and Edge only; not in lib.dom. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface OfflineState {
  /** The service worker controls this page: every file is cached and works offline. */
  offlineReady: boolean;
  online: boolean;
  /** A new version has installed and is waiting for the page to reload. */
  updateReady: boolean;
  /** The browser will show its install dialog if asked. */
  canInstall: boolean;
  /** Running as an installed app (its own window). */
  installed: boolean;
}

let state: OfflineState = {
  offlineReady: false,
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  updateReady: false,
  canInstall: false,
  installed: typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches,
};
const listeners = new Set<() => void>();
let installPrompt: BeforeInstallPromptEvent | null = null;
let registration: ServiceWorkerRegistration | null = null;
let started = false;

function set(patch: Partial<OfflineState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

function watchWaiting(reg: ServiceWorkerRegistration) {
  // A waiting worker while another controls the page is an update; the first
  // install activates itself (see sw.js).
  const check = () => set({ updateReady: !!reg.waiting && !!navigator.serviceWorker.controller });
  check();
  reg.addEventListener("updatefound", () => {
    const next = reg.installing;
    next?.addEventListener("statechange", () => {
      if (next.state === "installed") check();
    });
  });
}

/** Starts everything once; safe to call from every render. */
export function startOffline() {
  if (started || typeof window === "undefined") return;
  started = true;

  window.addEventListener("online", () => set({ online: true }));
  window.addEventListener("offline", () => set({ online: false }));
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installPrompt = e as BeforeInstallPromptEvent;
    set({ canInstall: true });
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    set({ canInstall: false, installed: true });
  });

  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  const sw = navigator.serviceWorker;
  if (sw.controller) set({ offlineReady: true });
  sw.addEventListener("controllerchange", () => set({ offlineReady: true }));
  void sw.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).then(
    (reg) => {
      registration = reg;
      watchWaiting(reg);
      // Long editing sessions still hear about new versions.
      setInterval(() => void reg.update().catch(() => {}), 60 * 60 * 1000);
    },
    () => {},
  );
}

/** Shows the browser's install dialog. */
export async function install() {
  const p = installPrompt;
  if (!p) return;
  await p.prompt();
  const { outcome } = await p.userChoice;
  installPrompt = null;
  set({ canInstall: false, installed: outcome === "accepted" || state.installed });
}

/** Activates the waiting version and reloads into it. */
export function applyUpdate() {
  const waiting = registration?.waiting;
  if (!waiting) return location.reload();
  navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true });
  waiting.postMessage({ type: "skip-waiting" });
}

export function useOfflineState(): OfflineState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
