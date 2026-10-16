// A quiet strip at the foot of every screen: whether Cartridge Studio works
// offline yet, an "Install app" button where the browser offers one, and a
// prompt to reload when a new version has arrived.

import { useEffect, useState } from "react";
import { applyUpdate, install, startOffline, useOfflineState } from "../pwa/offline.ts";
import "./app-status.css";

export function AppStatus() {
  useEffect(startOffline, []);
  const s = useOfflineState();
  const [laterUpdate, setLaterUpdate] = useState(false);

  const status = !s.online
    ? s.offlineReady
      ? "Offline: everything still works"
      : "Offline"
    : s.offlineReady
      ? "Works offline"
      : null;

  return (
    <>
      {(status || (s.canInstall && !s.installed)) && (
        <footer className="app-status">
          {status && (
            <span className="app-status-offline" data-testid="offline-status">
              <span aria-hidden="true" className={`app-status-dot${s.online ? "" : " off"}`} />
              {status}
            </span>
          )}
          {s.canInstall && !s.installed && (
            <button type="button" className="link" onClick={() => void install()}>
              Install app
            </button>
          )}
        </footer>
      )}
      <div role="status" className="app-update-region">
        {s.updateReady && !laterUpdate && (
          <div className="app-update">
            A new version is ready.
            <button type="button" onClick={applyUpdate}>
              Reload
            </button>
            <button type="button" className="link" onClick={() => setLaterUpdate(true)}>
              Later
            </button>
          </div>
        )}
      </div>
    </>
  );
}
