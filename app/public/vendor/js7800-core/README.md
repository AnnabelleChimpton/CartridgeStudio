# js7800 emulation core (worker build)

- Upstream: https://github.com/raz0red/js7800
- Commit: `fe918ce422bc130972c45510809f2caec4450efe`
- License: GPL v2 or later (`LICENSE`, `LICENSE-third-party`)
- Contents: js7800's `src/js/prosystem/*` core, unmodified, plus its event and
  md5 helpers. `web/audio.js` and `web/mouse.js` are replaced at bundle time
  by the worker-safe stand-ins in `app/js7800-core/`. The entry module is
  `app/js7800-core/entry.js`.
- Rebuild: `node app/scripts/build-js7800.mjs <work-dir>`

The app loads this file only in its emulator worker
(`app/src/emulator/emulator.worker.ts`).
