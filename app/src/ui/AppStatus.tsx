import { useEffect, useState } from "react";
import { applyUpdate, install, startOffline, useOfflineState } from "../pwa/offline.ts";
import "./app-status.css";

/** Said only while the network is down. */
export function OfflineIndicator() {
  const s = useOfflineState();
  if (s.online) return null;
  return (
    <span className="offline-indicator small" data-testid="offline-status">
      Offline. Your game still builds and saves.
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
