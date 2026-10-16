# js7800 (vendored, unmodified)

- Upstream: https://github.com/raz0red/js7800
- Commit: `fe918ce422bc130972c45510809f2caec4450efe` (2025-07-12)
- License: GPL v2 (`LICENSE`), with third-party notices in `LICENSE-third-party`
- Built with js7800's own steps (`db/convert.js`, then `webpack --mode=production`); no source changes.
- Rebuild: `node app/scripts/build-js7800.mjs <empty-dir>`

The app loads `js7800.min.js` as a separate script and talks to it only through
`app/src/emulator/js7800-emulator.ts`, which implements the `Emulator` interface.
