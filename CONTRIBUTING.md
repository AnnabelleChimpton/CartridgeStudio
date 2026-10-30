# Contributing to Cartridge Studio

Cartridge Studio is free software under the GNU General Public License,
version 3 or later (see `LICENSE`).

This is a one-person project for now. Issues and boot reports are welcome.
For code, open an issue first. If that changes, contributions will need a DCO
sign-off (developercertificate.org).

## Getting set up

```bash
npm ci
```

```bash
npm run setup
```

`npm run setup` fetches the pinned 7800basic release and copies it into the app.
Then, from `app/`:

- `npx tsc --noEmit -p .` type-checks.
- `npx vitest run` runs the unit tests.
- `npx playwright test --project=chromium` runs the browser tests against the
  production build.

Continuous integration runs the same commands on pull requests and pushes to
main (see `.github/workflows/`).

CI doesn't run MAME. Run it yourself after changing generated code:

- `npm run test:mame` (from the repo root) runs every template and kit
  starter game's behaviour tests in MAME's `a7800` driver. It needs MAME
  installed; see `harness/README.md`.
- From `app/`, `npx vitest run src/kit src/code src/files` is the quicker
  subset of the unit tests that builds ROMs for the kit, the code tier and
  the exports.

Generated code is pinned by snapshots in `app/src/kit/__snapshots__/`. When a
change to the generator is meant to change them, regenerate with
`npx vitest run -u src/kit/snapshots.test.ts` and read the diff before
committing it.

## Branches and commits

- Branch names are topic names, for example `cart-shelf`.
- Subjects are imperative and under 60 characters, one change per commit,
  for example "Fix doubled 'is' in rule sentences". Add a body only when the
  reason isn't obvious.
- Local notes and editor settings stay out of the repo (see .gitignore).

## Third-party code and notices

- The 7800basic toolchain, dasm and js7800 are GPL v2 programs that ship
  unchanged from upstream; js7800 is built from unmodified upstream source,
  with two worker-safe I/O stand-ins. Don't patch them in this repository.
- If you add or update a dependency the app ships, regenerate the notices and
  commit the result:

  ```bash
  npm run notices
  ```

## Trademarks and hardware claims

Atari is a trademark of its owner, and this project is not affiliated with or
endorsed by Atari. Don't add Atari logos or trademarks beyond plain
compatibility statements. Until games have been tested on real consoles, describe
them as "7800 cartridge format" and don't promise that they run on particular
hardware.
