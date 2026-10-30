import { CREDITS, LICENSE_URL, NOTICES_URL, versionLabel } from "./about.ts";
import { Dialog } from "./Dialog.tsx";
import "./about.css";

export function AboutDialog({ onClose, returnTo }: { onClose: () => void; returnTo?: HTMLElement | null }) {
  return (
    <Dialog title="About and licences" onClose={onClose} returnTo={returnTo} wide>
      <div className="about">
        <p>
          Cartridge Studio {versionLabel()} is free software under the{" "}
          <a href={LICENSE_URL} target="_blank" rel="noreferrer">
            GNU General Public License, version 3 or later
          </a>
          . The games you make with it are yours.
        </p>
        <h3>Made with</h3>
        <ul className="about-credits">
          {CREDITS.map((c) => (
            <li key={c.name}>
              <h4>
                {c.name} <span className="muted">({c.version})</span>
              </h4>
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
        <p className="muted">Atari is a trademark of Atari Interactive, Inc. Cartridge Studio is not affiliated with Atari.</p>
      </div>
    </Dialog>
  );
}
