// "About and licences": a small link at the foot of every screen and the
// dialog it opens, crediting the free software Cartridge Studio is built on.

import { useRef, useState } from "react";
import { APP_VERSION } from "../version.ts";
import { CREDITS, LICENSE_URL, NOTICES_URL } from "./about.ts";
import { Dialog } from "./Dialog.tsx";
import "./about.css";

export function AboutFooter() {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  return (
    <footer className="about-footer small">
      <button ref={opener} type="button" className="link small" onClick={() => setOpen(true)}>
        About and licences
      </button>
      {open && <AboutDialog onClose={() => setOpen(false)} returnTo={opener.current} />}
    </footer>
  );
}

export function AboutDialog({ onClose, returnTo }: { onClose: () => void; returnTo?: HTMLElement | null }) {
  return (
    <Dialog title="About and licences" onClose={onClose} returnTo={returnTo} wide>
      <div className="about">
        <p>
          Cartridge Studio {APP_VERSION} is free software: you can share and change it under the{" "}
          <a href={LICENSE_URL} target="_blank" rel="noreferrer">
            GNU General Public License, version 3 or later
          </a>
          . The games you make with it are yours.
        </p>
        <p>It's built on the work of these people and projects. Thank you.</p>
        <ul className="about-credits">
          {CREDITS.map((c) => (
            <li key={c.name}>
              <h3>
                {c.name} <span className="muted">({c.version})</span>
              </h3>
              <p>
                By {c.by}. {c.licence}.{c.note ? ` ${c.note}` : ""}
              </p>
              <p className="about-links">
                <a href={c.source} target="_blank" rel="noreferrer">
                  Source code
                </a>
                {c.files.map(([label, url]) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer">
                    {label}
                  </a>
                ))}
              </p>
            </li>
          ))}
        </ul>
        <p>
          Every other library the app includes, with its licence, is listed in the{" "}
          <a href={NOTICES_URL} target="_blank" rel="noreferrer">
            third-party notices
          </a>
          .
        </p>
        <p className="muted">
          Atari is a trademark of its owner. Cartridge Studio is not affiliated with or endorsed by Atari. It makes games in the 7800
          cartridge format; they have been tested in emulators, not yet on real consoles.
        </p>
      </div>
    </Dialog>
  );
}
