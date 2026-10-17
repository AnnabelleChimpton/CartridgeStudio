# Licensing

This page covers who owns what in Cartridge Studio, and under which licence each
part reaches you. It is a plain summary, not legal advice. The licence texts
themselves decide; they are in `LICENSE` and `THIRD_PARTY_NOTICES.txt`.

## Your game is yours

A game you make belongs to you: its art, rules, text and the ROM file built
from it. You can sell it, give it away, put it on a cartridge or keep it to
yourself, and license it however you like.

That holds because of what ends up inside the ROM:
- your own program, generated from your project;
- runtime routines from the Cartridge Studio game kit (`templates/`), which
  are CC0;
- 7800basic's 6502 runtime and the assembly it generates, which are CC0.

7800basic's licence also says binaries built from your own source are yours.

## Cartridge Studio is GPL v3 or later

The studio's own code (`app/`, `toolchain/`, `harness/`, `scripts/`) is free
software under the GNU General Public License, version 3 or later. See
`LICENSE`.

Contributors sign off their commits under the Developer Certificate of Origin
(see `CONTRIBUTING.md`). The DCO records that each contributor had the right
to submit their change. It does not hand the project any right to relicense
it. Each contribution is under the GPL v3 or later, like the rest of the
studio.

## The bundled tools keep their own licences

Cartridge Studio runs these programs unchanged, or with the changes listed
below. They belong to their authors, and no licence the project chooses can
replace theirs:

| Tool | By | Licence | What it does here |
| --- | --- | --- | --- |
| 7800basic 0.41 | Mike Saarna (RevEng) and contributors | GNU GPL v2 (compiler); CC0 (6502 runtime) | Compiles game.bas, as the release's own WebAssembly build |
| dasm | the dasm team | GNU GPL v2 | Assembles the compiler's output, bundled with 7800basic |
| sign7800 (7800sign) | Bruce Tomlin | GNU LGPL v2 | Writes the console's cartridge signature into the finished ROM |
| js7800 | raz0red, based on ProSystem by Greg Stanton | GNU GPL v2 or later | Plays games in the editor and in the one-file player |

js7800 is built from upstream source at a pinned commit. Two I/O stand-ins
replace upstream's `web/audio.js` and `web/mouse.js` so it runs in a worker,
and the result is minified. The stand-ins are in `app/js7800-core/`, and the
build is `app/scripts/build-js7800.mjs`.

sign7800 is a separate program run on the ROM after it is built. It is not
linked into your game, and the signature it writes is data the console
checks.

## What you pass on when you share

- **The .a78 or .bin file:** only your game, as above.
- **The one-file player (.html):** your game plus js7800, which is GPL v2 or
  later. The page includes js7800's licence and names the upstream commit it
  was built from. Anyone you share it with gets js7800 under that licence.
  Your game inside the page is still yours.
- **The exported source folder:** your game.bas and graphics, plus build
  scripts for a stock 7800basic you download yourself.

## Fonts

Atkinson Hyperlegible, embedded in the print kit PDFs, is under the SIL Open
Font License 1.1 (`app/public/fonts/`).
