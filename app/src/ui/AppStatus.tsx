// Offline status in three small pieces that can each live anywhere: whether
// Cartridge Studio works offline yet, a quiet "Install app" link where the
// browser offers one, and a prompt to reload when a new version has arrived.
// AppStatus puts them at the foot of every screen for now.

import { useEffect, useState } from "react";
import { applyUpdate, install, startOffline, useOfflineState } from "../pwa/offline.ts";
import "./app-status.css";

/** "Works offline" (or "Offline" while the network is down); nothing until it's true. */
export function OfflineIndicator() {
  const s = useOfflineState();
  const text = !s.online ? (s.offlineReady ? "Offline: everything still works" : "Offline") : s.offlineReady ? "Works offline" : null;
  if (!text) return null;
  return (
    <span className="offline-indicator small" data-testid="offline-status">
      <span aria-hidden="true" className={`offline-dot${s.online ? "" : " off"}`} />
      {text}
    </span>
  );
}

export function InstallButton() {
  const s = useOfflineState();
  if (!s.canInstall || s.installed) return null;
  return (
    <button type="button" className="link small" onClick={() => void install()}>
      Install app
    </button>
  );
}

/** Always rendered so screen readers hear the prompt when it appears. */
export function UpdatePrompt() {
  const s = useOfflineState();
  const [later, setLater] = useState(false);
  return (
    <div role="status">
      {s.updateReady && !later && (
        <div className="update-prompt">
          A new version is ready.
          <button type="button" onClick={applyUpdate}>
            Reload
          </button>
          <button type="button" className="link" onClick={() => setLater(true)}>
            Later
          </button>
        </div>
      )}
    </div>
  );
}

export function AppStatus() {
  useEffect(startOffline, []);
  return (
    <>
      <footer className="app-status">
        <OfflineIndicator />
        <InstallButton />
      </footer>
      <UpdatePrompt />
    </>
  );
}
