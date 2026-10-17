// "My games" on the start screen: every game made in this browser, newest
// first, with its picture. Open, rename, duplicate or delete (after asking).

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { duplicateGame, listGames, type GameEntry } from "../project/persist.ts";
import { KitText } from "./BrandMark.tsx";
import { ConfirmDialog, Dialog } from "./Dialog.tsx";

export interface LibraryActions {
  /** The game being edited now, if any. */
  current?: string;
  onOpen: (id: string) => void;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const KIND = { kit: "Game kit", code: "Code project" } as const;

/** "just now", "12 minutes ago", "today at 14:05", or the date. */
function when(ms: number, now = Date.now()) {
  const mins = Math.round((now - ms) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const d = new Date(ms);
  if (d.toDateString() === new Date(now).toDateString()) return `today at ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

function RenameDialog({ title, onSave, onClose }: { title: string; onSave: (title: string) => void; onClose: () => void }) {
  const [value, setValue] = useState(title);
  return (
    <Dialog title={`Rename “${title || "Untitled"}”`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onClose();
          onSave(value.trim() || title);
        }}
      >
        <div className="field-grid">
          <label>
            <span>New name</span>
            <input value={value} maxLength={40} autoFocus onChange={(e) => setValue(e.target.value)} />
          </label>
        </div>
        <div className="toolbar">
          <button type="submit">Rename</button>
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function MyGames({ current, onOpen, onRename, onDelete }: LibraryActions) {
  const [games, setGames] = useState<GameEntry[] | null>(null);
  const [renaming, setRenaming] = useState<GameEntry | null>(null);
  const [deleting, setDeleting] = useState<GameEntry | null>(null);
  const [said, setSaid] = useState("");
  const heading = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const refresh = () => listGames().then(setGames);
  useEffect(() => {
    void refresh();
  }, []);

  const pictures = useMemo(
    () => new Map((games ?? []).filter((g) => g.thumbnail).map((g) => [g.id, URL.createObjectURL(new Blob([g.thumbnail as Uint8Array<ArrayBuffer>], { type: "image/png" }))])),
    [games],
  );
  useEffect(() => () => pictures.forEach((url) => URL.revokeObjectURL(url)), [pictures]);

  if (!games?.length) return null;
  const name = (g: GameEntry) => g.title || "Untitled";

  return (
    <section className="my-games" aria-labelledby={heading}>
      <h3 id={heading} ref={headingRef} tabIndex={-1} className="section-h">
        My games
      </h3>
      <p className="muted small">Kept in this browser. Save a game file from the Game menu to keep a copy anywhere else.</p>
      <ul className="my-games-grid">
        {games.map((g) => (
          <li key={g.id} className="game-card">
            <button type="button" className="game-open" onClick={() => onOpen(g.id)}>
              <span className="game-picture" aria-hidden="true">
                {pictures.has(g.id) && <img src={pictures.get(g.id)} alt="" width={320} height={240} />}
              </span>
              <span className="card-body">
                <strong>
                  <KitText text={name(g)} />
                </strong>
                <span className="muted small">
                  {KIND[g.kind]} · {g.id === current ? "open now" : `changed ${when(g.updated)}`}
                </span>
              </span>
            </button>
            <div className="game-actions">
              <button type="button" className="quiet" aria-label={`Rename ${name(g)}`} onClick={() => setRenaming(g)}>
                Rename
              </button>
              <button
                type="button"
                className="quiet"
                aria-label={`Duplicate ${name(g)}`}
                onClick={async () => {
                  if (await duplicateGame(g.id)) setSaid(`Made a copy of “${name(g)}”.`);
                  await refresh();
                }}
              >
                Duplicate
              </button>
              <button type="button" className="quiet danger" aria-label={`Delete ${name(g)}`} onClick={() => setDeleting(g)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p role="status" className="visually-hidden">
        {said}
      </p>
      {renaming && (
        <RenameDialog
          title={renaming.title}
          onClose={() => setRenaming(null)}
          onSave={async (title) => {
            await onRename(renaming.id, title);
            setSaid(`Renamed to “${title}”.`);
            await refresh();
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={`Delete “${name(deleting)}”?`}
          message="It's removed from this browser for good. Save it as a game file first if you might want it back."
          yes="Delete game"
          danger
          onYes={async () => {
            await onDelete(deleting.id);
            setSaid(`Deleted “${name(deleting)}”.`);
            await refresh();
            // Its buttons are gone; keep the keyboard in the list.
            headingRef.current?.focus();
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </section>
  );
}
