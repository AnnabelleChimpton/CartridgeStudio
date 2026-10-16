# Cartridge Studio: design direction

This is the look and feel of Cartridge Studio, and the rules that keep it
consistent as more people add to it. The code that carries it out is
`app/src/styles.css` (tokens first, then components, then screens) and the
shell components in `app/src/ui/` (`TopBar`, `StartChooser`, `Toaster`,
`Icon`, `BrandMark`, and `prefs.ts` for the tier and theme).

## 1. Identity: the toy workbench

Cartridge Studio is a workbench for making small, real things. It should feel
like a well-made toy and a good tool at once: warm, tactile and calm, with
the game always the brightest thing on screen.

- **Warm, not neon.** Ink-plum darks and paper-cream lights instead of
  grey-blue developer chrome. One hot colour, *cartridge orange*, used for the
  one thing to do next, never for decoration.
- **Tactile.** Buttons have a small solid "keycap" edge underneath and press
  down 1 px when clicked. Panels are soft-cornered trays. Nothing is glassy.
- **Crafted, a little retro, not pastiche.** Rounded display type, pixel art
  shown crisp and at 2:1 like the console draws it, a few square-pixel
  details (the brand mark, the build tick). No scanline filters, no CRT
  curvature, no chrome bevels, no fake wood grain.
- **Ours.** No console makers' logos, wordmarks, rainbow stripes, fonts or
  trade dress. Consoles are named in plain text only where a creator needs to
  know what plays their game.
- **The game is the hero.** Editor chrome stays low-contrast and quiet so the
  live game and the creator's own art carry the colour.

Voice stays as it is today: short, friendly, plain words ("Things", "Show it",
"Send to family"), no jargon in Starter, real terms (ROM, 7800basic) in Coder.

## 2. Type

| Role | Font | Notes |
| --- | --- | --- |
| Display: brand, screen titles, card names, dialog titles | **Fredoka** (variable, 400–700), OFL | Rounded and toy-like. Never below 16 px. |
| Interface and reading | The system UI font (`system-ui`: SF Pro, Segoe UI, Roboto) | Crisp at small sizes, familiar, nothing to load. We tried Atkinson Hyperlegible: its slashed zero turns "7800" into "78ØØ" everywhere, which reads wrong for a console name. It stays in the print PDF. |
| Code and numbers that line up | system monospace (`ui-monospace`, SF Mono, Menlo) | Code views, the build log. |

Fredoka ships with the app (`app/src/assets/fonts/`, with its licence), so the
display type looks the same offline.

Scale (px), from `--fs-xs` to `--fs-3xl`:

| Token | Size | Use |
| --- | --- | --- |
| `--fs-xs` | 12 | Hints, captions (`.small`) |
| `--fs-sm` | 13 | Secondary UI text, badges |
| `--fs-md` | 14 | Controls, panel body |
| `--fs-body` | 15 | Reading text, rule sentences |
| `--fs-lg` | 18 | Section titles, dialog titles |
| `--fs-xl` | 22 | Panel titles on the start screen |
| `--fs-2xl` | 30 | Screen headline |
| `--fs-3xl` | 44 | Start screen hero |

Line height is 1.5 for reading text and 1.2 for display. Panel headings
(`h2` inside panels) are small caps-style labels: `--fs-sm`, 700, tracked
0.06em, muted.

## 3. Colour

Tokens are CSS custom properties on `:root`. Dark is the default look; light
follows the system setting, and the top bar has a theme switch (System, Light,
Dark) stored per browser (`data-theme` on `<html>`).

Every text pair below is at least 4.5:1 on every surface, and every edge of a
field or control at least 3:1 against what it sits on (WCAG 2.2 AA, 1.4.3 and
1.4.11). Check any new value against all four surfaces before using it; axe in
`e2e/shell.spec.ts` checks both themes.

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `--bg` | `#191520` | `#f7f1e6` | Page |
| `--surface` (`--panel`) | `#231e2c` | `#fffcf6` | Panels, cards, dialogs |
| `--raised` | `#2e2839` | `#f1e9db` | Secondary buttons, hovered rows |
| `--sunken` | `#120f17` | `#ece3d3` | Fields, wells, canvases' mats |
| `--line` | `#3b3449` | `#ddd2bf` | Dividers, panel edges (decorative) |
| `--field-line` | `#857c98` | `#8b7f6e` | Edges of things you type in or choose (≥ 3:1) |
| `--text` | `#f6efe3` | `#2b2234` | Body text |
| `--muted` | `#b9afc4` | `#675d6e` | Secondary text (≥ 4.5:1 on every surface) |
| `--accent` | `#ffa24c` | `#f08a3a` | Primary button fill, selection fill |
| `--on-accent` | `#221300` | `#2a1400` | Text on the accent fill |
| `--accent-text` | `#ffb26b` | `#a8470c` | Accent as text or as a thin line (links, the "fit" selects, active tab) |
| `--focus` | `#ffd27a` | `#c2560f` | Focus ring |
| `--ok` | `#7fdc9a` | `#256b3a` | Built, room to spare |
| `--error` | `#ff8f84` | `#bb3226` | Errors, danger |
| `--teal` | `#62d6c6` | `#0f6a5f` | Second accent: "play" and recording-ready states |

The old names (`--panel`, `--line`, `--field-line`, `--text`, `--muted`,
`--accent`, `--ok`, `--error`, `--bg`) still exist with the same meanings, so
markup and inline styles from other branches keep working.

The emulator, sprite mats and the room canvas stay on near-black in both
themes: pixel art is drawn for a TV, and the colours read truest there.

## 4. Space, shape, depth

- **Spacing** is a 4 px grid: `--s-1` 4, `--s-2` 8, `--s-3` 12, `--s-4` 16,
  `--s-5` 24, `--s-6` 32, `--s-7` 48.
- **Radii:** `--r-sm` 6 (fields, small buttons), `--r-md` 10 (buttons, rows),
  `--r-lg` 16 (panels, cards, dialogs), `--r-pill` (badges, segmented
  controls).
- **Depth:** three levels only. Flat (in a panel), `--shadow-1` (panels and
  cards), `--shadow-2` (menus, toasts, dialogs). Buttons add a 2 px solid
  `--edge` "keycap" under them instead of a blur.
- **Targets:** every control is at least 24 × 24 px (WCAG 2.5.8); main buttons
  are 36 px tall, top bar controls 36 px, tabs 44 px.
- **Layout:** the editor is a two-column workbench. Tabs and editing on the
  left, the game and Show it on the right in a sticky column. Widths:
  1280 px gives the play column 400 px; at 1920 px it grows to 560 px and the
  page stops at 1920 px. Below 1000 px (tablets) the game moves above the
  editor and the top bar wraps into two rows.

## 5. Motion

Motion explains what changed; it never decorates.

| Token | Value | Use |
| --- | --- | --- |
| `--dur-fast` | 120 ms | Hover, press |
| `--dur` | 200 ms | Menus, tabs, toasts |
| `--dur-slow` | 420 ms | Cartridge insert, dialog in |
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` | Most things |
| `--ease-spring` | `cubic-bezier(.34,1.56,.64,1)` | Little "toy" overshoots |

The delights, all small and skippable:

- **Build tick.** When the game is up to date a small pixel check pops in
  beside "Up to date".
- **Cartridge insert.** When an editor opens, the game screen slides down a
  few pixels into place with a slight bounce, like a cartridge seating.
- **Preset cards.** The cast animates through its frames; on hover the card
  lifts and the cast hops once.
- **Toasts** slide up from the bottom for saves and downloads, then leave on
  their own after a few seconds.
- **Buttons** press down 1 px.

With `prefers-reduced-motion: reduce`, durations drop to near zero, entrance
animations and the hop are removed, and the cast shows its first frame only.

## 6. Iconography

Small inline SVG icons drawn for this app (`app/src/ui/Icon.tsx`): a 20 px
grid, 1.75 px round-capped strokes in `currentColor`, slightly chunky to match
Fredoka. No icon font, no third-party set, so no licence to track and nothing
to download. Icons always sit beside a text label, or the button has an
`aria-label`; an icon alone never carries meaning for screen readers
(`aria-hidden="true"` on the SVG).

The brand mark (`BrandMark.tsx`) is an original chunky cartridge with a
four-pixel spark on its label, in cartridge orange and cream.

## 7. Three tiers, one app

Cartridge Studio serves three kinds of maker. They see the same app, the same
words and the same files; the tier decides only what is shown by default, so
nothing a Starter makes is out of reach of a Coder and back again.

| Tier | Who | Sees by default |
| --- | --- | --- |
| **Starter** | Families, kids, first-timers working from a preset | Things, Room and Game tabs. The game, Show it, the console-time meter. No rule editor, no counters, no developer drawer. (The classic shooter keeps all its tabs: its rules are simple switches.) |
| **Maker** | Hobbyists building their own game from rules | Everything in Starter, plus the Rules tab, counters and the "For developers" drawer (ROM downloads, build timings, the generated code). |
| **Coder** | People who want 7800basic itself | Everything in Maker, with the developer drawer open. The code workspace (a separate branch) plugs in here. |

How it shows up without clutter:

- **One control.** A three-way segmented switch labelled **Mode** in the top
  bar: Starter · Maker · Coder. It is stored per browser
  (`localStorage["cs-tier"]`) and written to `<html data-tier="…">`.
- **First visit is Starter.** A new creator is never shown everything at once.
  The switch is always visible, so the next step up is one click away.
- **Progressive disclosure inside each tier.** "More options" on things,
  "+ only if" and "+ another action" in rules, and the developer drawer stay
  closed until asked for.
- **Nothing is lost.** Switching down a tier hides editors, never data: a
  Starter can play and show a game whose rules a Maker wrote.
- **For code that wants to know:** `useTier()` in `app/src/ui/prefs.ts`. CSS can
  key off `[data-tier="starter"]`, `[data-tier="maker"]`,
  `[data-tier="coder"]`. Mark tier-gated tabs with `data-tab="…"`.

## 8. Components

All in `styles.css`, built only from the tokens above. Class names from
before the redesign keep working and keep their meaning.

- **Buttons:** primary (bare `button`), secondary (`.secondary`), quiet
  (`.quiet`, `.icon`, `.link`), danger (`.danger`, combinable with the rest).
- **Fields:** text inputs, `.num`, selects, textareas. Sunken fill, a 3:1
  `--field-line` edge, accent edge on hover, focus ring on focus.
- **The "fit" selects** (`select.fit`, `input.fit`) in rule sentences: words
  in a sentence, not boxes. Accent-coloured text with a dotted underline that
  turns solid on hover and focus.
- **Tabs** (`.workspace-tabs`): a pill rail; the selected tab is a raised
  surface with an accent underline.
- **Panels** (`.panel`), **dialogs** (`.dialog`), **toasts** (`.toast`),
  **badges** (`.badge`), **segmented controls** (`.segmented`), **menus**
  (`.menu`).
- **Empty states** (`.empty`): an icon, one sentence, one action.

## 9. Accessibility rules that don't bend

- WCAG 2.2 AA everywhere; axe runs in e2e on every screen and both editors.
- One focus ring style (`--focus`, 2 px, 2 px offset) on everything a keyboard
  can reach.
- 24 px minimum target size; 36 px for primary actions.
- Colour never carries meaning alone (the CPU meter has words, errors have
  text).
- Motion respects `prefers-reduced-motion`.
- Every drawing surface keeps its keyboard controls and live descriptions.
