# Contributing to Cartridge Studio

Thank you for helping. Cartridge Studio is free software under the GNU General
Public License, version 3 or later (see `LICENSE`).

## Sign off every commit (DCO)

Every commit must carry a `Signed-off-by` line, certifying the
[Developer Certificate of Origin 1.1](https://developercertificate.org/) below.
Git adds it for you:

```bash
git commit -s
```

The line uses your real name and an email address you can be reached at:

```
Signed-off-by: Your Name <you@example.com>
```

Pull requests with unsigned commits can't be merged. To sign commits you've
already made on a branch, run `git rebase --signoff main` and force-push.

Why: the sign-off records that you have the right to contribute your change.
Keeping that record for every contribution means the project can later offer
the code under an additional licence (for example a commercial licence for a
hardware partner) without tracking down every past contributor. Your
contribution stays available under the GPL either way.

### Developer Certificate of Origin 1.1

```
Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.

Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.


Developer's Certificate of Origin 1.1

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it.

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including all
    personal information I submit with it, including my sign-off) is
    maintained indefinitely and may be redistributed consistent with
    this project or the open source license(s) involved.
```

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

Continuous integration runs the same commands on every pull request (see
`.github/workflows/`).

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
