// The creator's side of a jam: a few words about the game, a licence, then one
// button that packs everything the organizer needs into a ZIP.

import { useId, useState } from "react";
import { ENTRY_LIMITS, LICENCES } from "../files/package.ts";
import { useRecentClip } from "../files/recent-clip.ts";
import type { Preview } from "../ui/usePreview.ts";
import { download } from "../ui/usePreview.ts";
import { APP_VERSION } from "../version.ts";
import { entryFlags, entryProblem, entryTitle, jamEntryZip } from "./entry.ts";
import type { GameFacts } from "./limits.ts";
import { useJamStore, type EntryWords } from "./store.ts";
import "./jam.css";

interface Props {
  preview: Preview;
  gameTitle: string;
  /** The .cartridge game file, with its thumbnail; games without one leave it out. */
  cartridgeFile?: () => Promise<Uint8Array>;
  /** For the brief's limits. */
  facts: GameFacts;
  /** The runtime and toolchain that build this game, for the manifest. */
  runtime: string;
  toolchain: string;
}

type TextKey = "title" | "credits" | "description" | "controls";

export function JamEntryPanel({ preview, gameTitle, cartridgeFile, facts, runtime, toolchain }: Props) {
  const brief = useJamStore((s) => s.brief);
  const words = useJamStore((s) => s.words);
  const clip = useRecentClip((s) => s.gif);
  const setClip = useRecentClip((s) => s.set);
  const { setWords } = useJamStore.getState();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const id = useId();
  if (!brief) return null;
  const ready = !!preview.lastGood;
  const title = entryTitle(words, gameTitle);
  const problem = entryProblem(words);
  const flags = entryFlags(brief, { ...facts, romBytes: preview.lastGood?.a78.length }, APP_VERSION);

  const make = async () => {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const rom = await preview.buildSigned();
      const [{ buildPlayerHtml }, cartridge] = await Promise.all([import("../player/player.ts"), cartridgeFile?.()]);
      const entry = await jamEntryZip({
        brief,
        words,
        gameTitle,
        build: { app: APP_VERSION, runtime, toolchain },
        facts,
        player: await buildPlayerHtml(title, rom.a78, preview.source()),
        a78: rom.a78,
        bin: rom.bin,
        cartridge,
        clip,
      });
      download(entry.zip, entry.name);
      setDone(entry.name);
    } catch (e) {
      setError(`We couldn't make the entry: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const field = (key: TextKey, label: string, opts: { area?: boolean; placeholder?: string; hint?: string } = {}) => {
    const props = {
      id: `${id}-${key}`,
      value: words[key],
      maxLength: ENTRY_LIMITS[key],
      placeholder: opts.placeholder,
      "aria-describedby": opts.hint ? `${id}-${key}-hint` : undefined,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setWords({ [key]: e.target.value } as Partial<EntryWords>),
    };
    return (
      <div className="jam-field">
        <label htmlFor={props.id}>{label}</label>
        {opts.area ? <textarea rows={3} {...props} /> : <input type="text" {...props} />}
        {opts.hint && (
          <span id={`${id}-${key}-hint`} className="muted small">
            {opts.hint}
          </span>
        )}
      </div>
    );
  };

  return (
    <section className="panel jam-entry" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`}>Jam entry</h2>
      <p className="small">
        For <strong>{brief.name}</strong>
        {brief.theme && (
          <>
            {" "}
            · theme <strong>{brief.theme}</strong>
          </>
        )}
      </p>
      {field("title", "Title", { placeholder: gameTitle, hint: "Leave empty to use the game's title." })}
      {field("credits", "Credits", { placeholder: "Who made it, e.g. Sam and Robin" })}
      {field("description", "Short description", { area: true, placeholder: "One or two sentences for the gallery." })}
      {field("controls", "Controls", { placeholder: "e.g. Arrows move, fire button jumps" })}

      <div className="jam-field">
        <label htmlFor={`${id}-licence`}>Licence (required)</label>
        <select
          id={`${id}-licence`}
          required
          aria-describedby={`${id}-licence-hint`}
          value={words.licence}
          onChange={(e) => setWords({ licence: e.target.value })}
        >
          <option value="">Choose how others may use your game…</option>
          {LICENCES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <span id={`${id}-licence-hint`} className="muted small">
          Everyone can play your entry in the gallery whatever you choose. The licence says what else people may do with it.
        </span>
      </div>
      <label className="jam-check">
        <input type="checkbox" checked={words.compilation} onChange={(e) => setWords({ compilation: e.target.checked })} /> The organizer may put my game on
        a compilation, such as a multi-game cartridge or a collection, with credit.
      </label>

      <div className="jam-clip">
        <span>
          Clip:{" "}
          {clip ? (
            <strong className="ok-text">ready ({Math.round(clip.length / 1024)} KB)</strong>
          ) : (
            <span className="muted">none yet. Use “Make a clip” in Show it, or choose a GIF.</span>
          )}
        </span>
        <label className="jam-file-link">
          {clip ? "Choose another GIF" : "Choose a GIF"}
          <input
            type="file"
            accept="image/gif,.gif"
            className="visually-hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              const bytes = new Uint8Array(await f.arrayBuffer());
              if (new TextDecoder().decode(bytes.subarray(0, 3)) !== "GIF") setError(`${f.name} isn't a GIF.`);
              else setClip(bytes);
            }}
          />
        </label>
        {clip && (
          <button type="button" className="link" onClick={() => setClip(null)}>
            Remove clip
          </button>
        )}
      </div>

      {flags.length > 0 && (
        <div className="jam-flags">
          <p className="small">
            <strong>Worth knowing:</strong> the organizer will see these notes. You can still send your entry.
          </p>
          <ul className="small">
            {flags.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="toolbar">
        <button type="button" disabled={!ready || busy || !!problem} aria-describedby={problem ? `${id}-problem` : undefined} onClick={() => void make()}>
          {busy ? "Making the entry…" : "Make my jam entry"}
        </button>
      </div>
      {problem && (
        <p id={`${id}-problem`} className="muted small">
          {problem}
        </p>
      )}
      <p className="muted small">
        One ZIP with a page that plays the game offline, {cartridgeFile ? "the game file, " : ""}signed ROMs{clip ? ", your clip" : ""} and these
        details.
      </p>
      <div aria-live="polite">
        {done && (
          <p className="jam-done">
            Saved <strong>{done}</strong>. Send it to the organizer
            {brief.link ? (
              <>
                {" "}
                as{" "}
                <a href={brief.link} target="_blank" rel="noreferrer">
                  the jam page<span className="visually-hidden"> (opens in a new tab)</span>
                </a>{" "}
                says
              </>
            ) : null}
            .
          </p>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
