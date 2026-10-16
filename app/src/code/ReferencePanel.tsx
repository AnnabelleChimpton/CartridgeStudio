// The 7800basic quick reference: search, read, insert an example at the
// cursor. The official guide is a link away for everything else.

import { useId, useState } from "react";
import { GUIDE_URL, REPO_URL, TOPICS, searchReference } from "./reference.ts";

export function ReferencePanel({ onInsert }: { onInsert?: (snippet: string) => void }) {
  const [query, setQuery] = useState("");
  const ids = useId();
  const found = searchReference(query);

  return (
    <section className="panel reference" aria-labelledby={`${ids}-h`}>
      <h2 id={`${ids}-h`}>7800basic reference</h2>
      <p className="lead muted">
        The commands Cartridge Studio's games use, and the common ones. For everything else, read the{" "}
        <a href={GUIDE_URL} target="_blank" rel="noreferrer">
          7800basic guide
        </a>{" "}
        or{" "}
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          7800basic on GitHub
        </a>
        .
      </p>
      <div className="ref-search">
        <label htmlFor={`${ids}-q`}>Search</label>
        <input
          id={`${ids}-q`}
          type="search"
          value={query}
          placeholder="plotsprite, joystick, sound…"
          onChange={(e) => setQuery(e.target.value)}
          aria-describedby={`${ids}-count`}
        />
        <span className="muted small" id={`${ids}-count`} role="status">
          {found.length === 1 ? "1 entry" : `${found.length} entries`}
        </span>
      </div>
      {TOPICS.map((topic) => {
        const entries = found.filter((e) => e.topic === topic);
        if (!entries.length) return null;
        return (
          <section key={topic} aria-labelledby={`${ids}-${topic}`}>
            <h3 id={`${ids}-${topic}`} className="section-h">
              {topic}
            </h3>
            <dl className="ref-list">
              {entries.map((e) => (
                <div key={e.name} className="ref-entry">
                  <dt>
                    <code>{e.syntax}</code>
                  </dt>
                  <dd>
                    {e.summary}
                    {onInsert && e.example && (
                      <>
                        {" "}
                        <button type="button" className="link" aria-label={`Insert ${e.name} into game.bas`} onClick={() => onInsert(e.example!)}>
                          Insert
                        </button>
                      </>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
    </section>
  );
}
