// "How to run a jam" (organize.html): make the brief, share the link, collect
// entries, build the gallery, judge. No server and no accounts at any step.

import { useId, useState, type ReactNode } from "react";
import { slugify } from "../files/exports.ts";
import { KIT_PRESETS } from "../kit/presets.ts";
import { download } from "../ui/usePreview.ts";
import { APP_VERSION } from "../version.ts";
import { JAM_EXTENSION, LONG_LINK, MAX_STARTERS, MAX_STARTER_BYTES, briefFileText, briefLink, newBrief, type JamBrief } from "./brief.ts";
import { LIMIT_LABELS, cartridgeFacts, type Limits } from "./limits.ts";
import "./jam.css";

/** The creator app, next to this page. */
const appBase = () => new URL("./", location.href).toString();

export function JamPageShell({ title, current, children }: { title: string; current: "guide" | "gallery"; children: ReactNode }) {
  return (
    <div className="page jam-page">
      <nav className="jam-nav" aria-label="Jam pages">
        <a href="./">Cartridge Studio</a>
        <a href="#" aria-current={current === "guide" ? "page" : undefined}>
          How to run a jam
        </a>
        <a href="#gallery" aria-current={current === "gallery" ? "page" : undefined}>
          Gallery builder
        </a>
      </nav>
      <main>
        <h1>{title}</h1>
        {children}
      </main>
      <footer className="muted small jam-footer">Made with Cartridge Studio {APP_VERSION}. Not affiliated with or endorsed by Atari.</footer>
    </div>
  );
}

export const SUGGESTED_THEMES = [
  "One more life",
  "It's behind you",
  "Small world",
  "Out of time",
  "Collect them all",
  "The floor is lava",
  "Upside down",
  "Two of a kind",
  "Night shift",
  "Lost and found",
];

const SUGGESTED_RULES = ["One room", "Two colours", "No shooting", "Under 3 minutes to finish", "Only one kind of enemy"];
const SUGGESTED_CRITERIA = ["Fun", "Theme", "Look and sound"];

function base64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const lines = (s: string, max: number) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, max);

function BriefMaker() {
  const id = useId();
  const [f, setF] = useState({ name: "", theme: "", dates: "", constraints: "", criteria: SUGGESTED_CRITERIA.join("\n"), link: "" });
  const [presets, setPresets] = useState<string[]>([]);
  const [limits, setLimits] = useState<Limits>({});
  const [starters, setStarters] = useState<JamBrief["starters"]>([]);
  const [pin, setPin] = useState(true);
  const [copied, setCopied] = useState(false);
  const [starterError, setStarterError] = useState<string | null>(null);

  let brief: JamBrief | null = null;
  let problem: string | null = null;
  if (f.name.trim()) {
    const link = f.link.trim();
    if (link && !/^https?:\/\/\S+$/.test(link)) problem = "The jam page must be a web address starting with https://";
    else {
      try {
        brief = newBrief({
          name: f.name,
          theme: f.theme,
          dates: f.dates,
          constraints: lines(f.constraints, 8),
          criteria: lines(f.criteria, 8),
          presets,
          starters,
          limits,
          ...(pin ? { app: APP_VERSION } : {}),
          ...(link ? { link } : {}),
        });
      } catch {
        problem = "Something in the brief is too long.";
      }
    }
  }
  const url = brief ? briefLink(brief, appBase()) : "";
  const touched = () => setCopied(false);

  const field = (key: keyof typeof f, label: string, opts: { area?: boolean; hint?: string; placeholder?: string } = {}) => {
    const p = {
      id: `${id}-${key}`,
      value: f[key],
      placeholder: opts.placeholder,
      "aria-describedby": opts.hint ? `${id}-${key}-hint` : undefined,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        touched();
        setF({ ...f, [key]: e.target.value });
      },
    };
    return (
      <div className="jam-field">
        <label htmlFor={p.id}>{label}</label>
        {opts.area ? <textarea rows={3} {...p} /> : <input type="text" maxLength={key === "link" ? 500 : 120} {...p} />}
        {opts.hint && (
          <span id={`${id}-${key}-hint`} className="muted small">
            {opts.hint}
          </span>
        )}
      </div>
    );
  };

  const addStarter = async (file: File) => {
    setStarterError(null);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length > MAX_STARTER_BYTES) return setStarterError(`${file.name} is too big to put in a brief.`);
    if (!cartridgeFacts(bytes)) return setStarterError(`${file.name} isn't a game kit .cartridge file.`);
    touched();
    setStarters([...starters, { name: file.name.replace(/\.cartridge$/i, "").slice(0, 40) || "Starter", cartridge: base64(bytes) }]);
  };

  return (
    <div className="jam-maker">
      <div className="jam-form">
        {field("name", "Jam name", { placeholder: "e.g. Spooky Cartridge Jam" })}
        {field("theme", "Theme", { placeholder: SUGGESTED_THEMES[0] })}
        {field("dates", "Dates", { placeholder: "e.g. Fri 31 Oct to Sun 2 Nov" })}
        {field("constraints", "Rules, one per line (optional)", { area: true, hint: `Ideas: ${SUGGESTED_RULES.join(", ")}.` })}
        {field("criteria", "What judges score, one per line", { area: true, hint: "Each becomes a column in the judges' sheet. Up to 8." })}
        {field("link", "Jam page (optional)", { placeholder: "https://itch.io/jam/…", hint: "Where creators read the rules and send their entries." })}

        <fieldset className="jam-limits">
          <legend>Limits the app checks (optional)</legend>
          <p className="muted small">Entries that go past a limit are flagged for you and the judges, not refused.</p>
          {(Object.keys(LIMIT_LABELS) as (keyof Limits)[]).map((k) => (
            <div className="jam-field" key={k}>
              <label htmlFor={`${id}-limit-${k}`}>{LIMIT_LABELS[k]}</label>
              <input
                id={`${id}-limit-${k}`}
                type="number"
                min={1}
                max={k === "maxRomKB" ? 1024 : 64}
                value={limits[k] ?? ""}
                onChange={(e) => {
                  touched();
                  const v = Math.round(Number(e.target.value));
                  const next = { ...limits };
                  if (e.target.value === "" || !(v >= 1)) delete next[k];
                  else next[k] = Math.min(v, k === "maxRomKB" ? 1024 : 64);
                  setLimits(next);
                }}
              />
            </div>
          ))}
        </fieldset>

        <fieldset className="jam-presets">
          <legend>Built-in starting games to offer</legend>
          <p className="muted small">Tick none to offer all of them.</p>
          {KIT_PRESETS.map((s) => (
            <label key={s.id}>
              <input
                type="checkbox"
                checked={presets.includes(s.id)}
                onChange={(e) => {
                  touched();
                  setPresets(e.target.checked ? [...presets, s.id] : presets.filter((p) => p !== s.id));
                }}
              />{" "}
              {s.name}
            </label>
          ))}
        </fieldset>

        <fieldset className="jam-presets">
          <legend>The jam's own starting games (optional)</legend>
          <p className="muted small">Game kit .cartridge files, up to {MAX_STARTERS}. They travel inside the brief.</p>
          {starters.length > 0 && (
            <ul className="jam-starter-list">
              {starters.map((s, i) => (
                <li key={`${s.name}-${i}`}>
                  {s.name}{" "}
                  <button
                    type="button"
                    className="link"
                    onClick={() => {
                      touched();
                      setStarters(starters.filter((_, j) => j !== i));
                    }}
                  >
                    Remove<span className="visually-hidden"> {s.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {starters.length < MAX_STARTERS && (
            <label className="jam-file-link">
              Add a starting game (.cartridge)
              <input
                type="file"
                accept=".cartridge"
                className="visually-hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void addStarter(file);
                }}
              />
            </label>
          )}
          {starterError && (
            <p className="error" role="alert">
              {starterError}
            </p>
          )}
        </fieldset>

        <label className="jam-check">
          <input
            type="checkbox"
            checked={pin}
            onChange={(e) => {
              touched();
              setPin(e.target.checked);
            }}
          />{" "}
          Pin the jam to this version of Cartridge Studio ({APP_VERSION}). Entries made with another version are flagged, so every game is
          judged on the same footing.
        </label>
      </div>
      <div className="jam-output">
        {problem && <p className="error">{problem}</p>}
        {!brief && !problem && <p className="muted">Give the jam a name to get its link.</p>}
        {brief && (
          <>
            <label htmlFor={`${id}-url`}>The jam link</label>
            <textarea id={`${id}-url`} className="jam-url" readOnly rows={4} value={url} onFocus={(e) => e.currentTarget.select()} />
            <div className="toolbar">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(url).then(
                    () => setCopied(true),
                    () => setCopied(false),
                  );
                }}
              >
                Copy link
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => download(new TextEncoder().encode(briefFileText(brief)), `${slugify(brief.name)}${JAM_EXTENSION}`)}
              >
                Download the brief ({JAM_EXTENSION})
              </button>
              <a href={url} target="_blank" rel="noreferrer">
                Try it<span className="visually-hidden"> (opens in a new tab)</span>
              </a>
            </div>
            <p className="muted small" aria-live="polite">
              {copied ? "Copied." : `${url.length} characters.`}
            </p>
            {url.length > LONG_LINK && (
              <p className="small">
                This link is long{starters.length ? " because of the starting games" : ""}: some chat apps and forums cut long links. Share the{" "}
                {JAM_EXTENSION} file as well.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function JamGuide() {
  const id = useId();
  return (
    <JamPageShell title="How to run a jam" current="guide">
      <p className="jam-lede">
        A jam on Cartridge Studio needs no server and no sign-ups. You make a brief, share one link, collect ZIP files, and build a
        gallery you can post anywhere. Every game is a real 7800 cartridge program that also plays in any web browser.
      </p>

      <section aria-labelledby={`${id}-1`}>
        <h2 id={`${id}-1`}>1. Make the brief</h2>
        <p>
          The brief is the jam's name, theme, dates and any extra rules, what judges will score, and limits the app can check. You can
          narrow the built-in starting games or add your own. Everything stays in the link: nothing is uploaded.
        </p>
        <BriefMaker />
      </section>

      <section aria-labelledby={`${id}-2`}>
        <h2 id={`${id}-2`}>2. Share the link</h2>
        <p>
          Post the jam link on your jam page (itch.io jams work well), a forum thread or a chat. Opening it shows a jam banner with the
          theme and rules, and the entry form. If a link is too long for where you post, share the <code>{JAM_EXTENSION}</code> file
          instead: creators open it from the start screen or with Open.
        </p>
        <p className="muted small">
          A pinned jam names the version of Cartridge Studio it was made with ({APP_VERSION} here). Creators on another version can still
          enter; their entry says which version they used.
        </p>
      </section>

      <section aria-labelledby={`${id}-3`}>
        <h2 id={`${id}-3`}>3. Collect entries</h2>
        <p>
          In the editor, creators fill in a title, credits, a short description and the controls, choose a licence, say whether you may
          put their game on a compilation, and press <em>Make my jam entry</em>. That saves one ZIP holding the signed ROMs, the game file,
          a clip if they made one, and a <code>manifest.json</code> with the build, the licence and the ROM's fingerprint (SHA-256).
        </p>
        <p>
          Ask for that ZIP, unchanged, through your jam page's submission form, by email, or in a forum post. The ROM is what gets judged:
          if it's changed after the entry was made, the gallery builder notices.
        </p>
      </section>

      <section aria-labelledby={`${id}-4`}>
        <h2 id={`${id}-4`}>4. Build the gallery</h2>
        <p>
          Open the <a href="#gallery">gallery builder</a>, drop in every entry ZIP and press <em>Build the gallery</em>. It checks each
          entry against the brief and makes every game's player page afresh from its ROM, so nothing an entrant sent runs as code on your
          site. You get one ZIP with an <code>index.html</code> showing every game.
        </p>
        <ul>
          <li>
            <strong>itch.io:</strong> make an HTML project, upload the gallery ZIP and tick “This file will be played in the browser”.
          </li>
          <li>
            <strong>GitHub Pages:</strong> unzip it into a repository and turn on Pages for that branch.
          </li>
          <li>
            <strong>A stream or a party:</strong> unzip it anywhere and open <code>index.html</code>. No internet needed.
          </li>
        </ul>
      </section>

      <section aria-labelledby={`${id}-5`}>
        <h2 id={`${id}-5`}>5. Judge</h2>
        <ol>
          <li>
            In the gallery builder, tick <em>Anonymous</em> to leave out credits while judging, build the gallery for the judges, and
            download the judges' sheet (a CSV file with a column for each thing they score).
          </li>
          <li>Each judge plays every game and fills in their copy of the sheet in any spreadsheet app, for example scores from 1 to 5.</li>
          <li>
            Add the filled-in sheets back in the gallery builder. It averages them into a results page, then build the final gallery with
            credits on.
          </li>
        </ol>
      </section>

      <section aria-labelledby={`${id}-6`}>
        <h2 id={`${id}-6`}>Suggested themes</h2>
        <p>Short themes that suit one-screen games and can be read more than one way:</p>
        <ul className="jam-themes">
          {SUGGESTED_THEMES.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="muted small">
          A weekend suits newcomers; a week suits people who want to draw every frame. Announce the theme when the jam starts, not
          before.
        </p>
      </section>
    </JamPageShell>
  );
}
