// The jam a creator has joined, always in view: its theme and rules, the
// organizer's page, and a way out.

import { useJamStore } from "./store.ts";
import "./jam.css";

export function JamBanner({ onNewGame }: { onNewGame?: () => void }) {
  const brief = useJamStore((s) => s.brief);
  if (!brief) return null;
  const leave = () => {
    if (confirm(`Leave ${brief.name}? Your game stays; only the jam banner and entry form go.`)) useJamStore.getState().leave();
  };
  return (
    <aside className="jam-banner" aria-label="Game jam">
      <div className="jam-banner-main">
        <p className="jam-banner-name">
          <span className="jam-tag">Jam</span> <strong>{brief.name}</strong>
          {brief.dates && <span className="muted"> · {brief.dates}</span>}
        </p>
        {brief.theme && (
          <p className="jam-banner-theme">
            Theme: <strong>{brief.theme}</strong>
          </p>
        )}
        {brief.constraints.length > 0 && (
          <ul className="jam-rules" aria-label="Jam rules">
            {brief.constraints.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="jam-banner-actions">
        {brief.link && (
          <a href={brief.link} target="_blank" rel="noreferrer">
            About the jam<span className="visually-hidden"> (opens in a new tab)</span>
          </a>
        )}
        {onNewGame && (
          <button type="button" className="secondary" onClick={onNewGame}>
            Start a jam game
          </button>
        )}
        <button type="button" className="link" onClick={leave}>
          Leave jam
        </button>
      </div>
    </aside>
  );
}

/** Ways into jams from the start screen, for creators and organizers. */
export function JamLinks({ onBrief }: { onBrief: (file: File) => void }) {
  return (
    <p className="jam-links muted small">
      Joining a game jam?{" "}
      <label className="jam-file-link">
        Open its brief (.jam.json)
        <input
          type="file"
          accept=".json,application/json"
          className="visually-hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onBrief(f);
          }}
        />
      </label>{" "}
      · Running one? <a href="?jam-guide">How to run a jam</a>
    </p>
  );
}
