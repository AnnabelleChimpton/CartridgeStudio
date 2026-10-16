// The organizer's gallery builder (?jam-gallery): drop in every entry ZIP and
// get one static site to post.

import { useId, useState } from "react";
import { download } from "../ui/usePreview.ts";
import { readEntryZip, type ReadEntry } from "./entry.ts";
import { galleryZip, infoFromEntries } from "./gallery.ts";
import { useJamStore } from "./store.ts";
import { JamPageShell } from "./JamGuide.tsx";
import { slugify } from "../files/exports.ts";
import "./jam.css";

interface Added {
  file: string;
  read: ReadEntry;
}

export function JamGallery() {
  const brief = useJamStore((s) => s.brief);
  const [added, setAdded] = useState<Added[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [over, setOver] = useState(false);
  const [info, setInfo] = useState(() => ({
    name: brief?.name ?? "",
    theme: brief?.theme ?? "",
    dates: brief?.dates ?? "",
    constraints: brief?.constraints.join("\n") ?? "",
    link: brief?.link ?? "",
  }));
  const [built, setBuilt] = useState<string | null>(null);
  const id = useId();

  const add = async (files: FileList | File[]) => {
    const next: Added[] = [];
    const bad: string[] = [];
    for (const f of Array.from(files)) {
      const r = readEntryZip(new Uint8Array(await f.arrayBuffer()));
      if (r.ok) next.push({ file: f.name, read: r.read });
      else bad.push(`${f.name}: ${r.error}`);
    }
    setProblems(bad);
    setBuilt(null);
    setAdded((a) => [...a.filter((x) => !next.some((n) => n.file === x.file)), ...next]);
    // The first entries name the jam when there's no brief.
    if (next.length) {
      const from = infoFromEntries(next.map((x) => x.read));
      setInfo((i) => (i.name ? i : { ...i, name: from.name, theme: i.theme || (from.theme ?? "") }));
    }
  };

  const build = () => {
    const name = info.name.trim() || "Game jam";
    const zip = galleryZip(
      {
        name,
        theme: info.theme.trim(),
        dates: info.dates.trim(),
        constraints: info.constraints.split("\n").map((s) => s.trim()).filter(Boolean),
        link: /^https?:\/\//.test(info.link.trim()) ? info.link.trim() : undefined,
      },
      added.map((a) => a.read),
    );
    const file = `${slugify(name)}-gallery.zip`;
    download(zip, file);
    setBuilt(file);
  };

  const text = (key: keyof typeof info, label: string, area = false) => (
    <div className="jam-field">
      <label htmlFor={`${id}-${key}`}>{label}</label>
      {area ? (
        <textarea id={`${id}-${key}`} rows={3} value={info[key]} onChange={(e) => setInfo({ ...info, [key]: e.target.value })} />
      ) : (
        <input id={`${id}-${key}`} type="text" value={info[key]} onChange={(e) => setInfo({ ...info, [key]: e.target.value })} />
      )}
    </div>
  );

  return (
    <JamPageShell title="Build the jam gallery">
      <p>
        Add every entry ZIP your creators sent. You'll get one ZIP with a gallery page and each game's player: post it on itch.io as an
        HTML project, put it on GitHub Pages, or just open <code>index.html</code> from a folder. It works with no internet.
      </p>

      <section aria-labelledby={`${id}-add`}>
        <h2 id={`${id}-add`}>1. Add the entries</h2>
        <div
          className={`jam-drop${over ? " over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            void add(e.dataTransfer.files);
          }}
        >
          <label className="button-like">
            Choose entry ZIPs
            <input
              type="file"
              multiple
              accept=".zip,application/zip"
              className="visually-hidden"
              onChange={(e) => {
                const f = e.target.files;
                if (f) void add(Array.from(f));
                e.target.value = "";
              }}
            />
          </label>
          <span className="muted">or drop them here</span>
        </div>
        {problems.length > 0 && (
          <div role="alert">
            <ul className="error">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        {added.length > 0 && (
          <table className="jam-table">
            <caption className="visually-hidden">Entries added</caption>
            <thead>
              <tr>
                <th scope="col">Game</th>
                <th scope="col">Credits</th>
                <th scope="col">Clip</th>
                <th scope="col">
                  <span className="visually-hidden">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {added.map((a) => (
                <tr key={a.file}>
                  <th scope="row">{a.read.entry.title}</th>
                  <td>{a.read.entry.credits || <span className="muted">none</span>}</td>
                  <td>{a.read.files.clip ? "Yes" : "No"}</td>
                  <td>
                    <button type="button" className="link" onClick={() => setAdded(added.filter((x) => x !== a))}>
                      Remove<span className="visually-hidden"> {a.read.entry.title}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="muted small" aria-live="polite">
          {added.length} {added.length === 1 ? "entry" : "entries"} added.
        </p>
      </section>

      <section aria-labelledby={`${id}-about`}>
        <h2 id={`${id}-about`}>2. Say what the jam was</h2>
        <div className="jam-form">
          {text("name", "Jam name")}
          {text("theme", "Theme")}
          {text("dates", "Dates")}
          {text("constraints", "Rules (one per line)", true)}
          {text("link", "Jam page (https://…)")}
        </div>
      </section>

      <section aria-labelledby={`${id}-build`}>
        <h2 id={`${id}-build`}>3. Build it</h2>
        <div className="toolbar">
          <button type="button" disabled={added.length === 0} onClick={build}>
            Build the gallery
          </button>
        </div>
        <div aria-live="polite">
          {built && (
            <p className="jam-done">
              Saved <strong>{built}</strong>. Unzip it and open <code>index.html</code> to check it, then post the folder.
            </p>
          )}
        </div>
      </section>
    </JamPageShell>
  );
}
