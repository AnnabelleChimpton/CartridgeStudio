# Emulator test harness

Tests that run games in emulators other than the app's own js7800 core. SPEC.md treats js7800 as a preview, so every template behaviour test also runs in MAME's `a7800` driver.

## MAME behaviour tests

```bash
npm run test:mame
```

This runs every `templates/<id>/tests/*.json` file, and every kit starter game's `templates/kit/games/*.tests.json`, in MAME and reports pass or fail for each one. The test format is the same one the js7800 runner uses (see `templates/README.md`, "Behaviour tests"). If MAME isn't installed, the suite is skipped with a message saying how to install it.

### Installing MAME

- macOS: `brew install mame`
- Debian/Ubuntu: `sudo apt install mame`
- Windows: download it from mamedev.org and put `mame.exe` on your `PATH`, or set `MAME_PATH`.

Tested with MAME 0.289. Any version with the Lua frame notifier API (`emu.add_machine_frame_notifier`, 0.254 or later) should work.

### The BIOS

The `a7800` driver needs a BIOS ROM. You don't need a copy of Atari's: by default the harness writes a 4 KB **stub BIOS** to a temp folder and points MAME at it. The stub skips the cartridge signature check, then hands over the way the real BIOS finishes: it writes INPTCTRL = `$07` from zero-page RAM and jumps through the cartridge's reset vector. MAME prints a `WRONG CHECKSUMS` warning for it. That's expected, and the harness ignores it.

To use the real BIOS, set `MAME_ROMPATH` to a folder holding a dump you own, in either of these forms:

```
<folder>/a7800.zip        containing 7800.u7  (CRC 5d13730c)
<folder>/a7800/7800.u7
```

The real BIOS checks the cartridge signature, which is why the harness always builds signed ROMs. The suite's first line says which BIOS ran.

| Variable | Effect |
| --- | --- |
| `MAME_PATH` | MAME binary (default `mame` on `PATH`) |
| `MAME_ROMPATH` | Folders to search for the real BIOS, separated like `PATH` |
| `MAME_BIOS=stub` | Use the stub even when the real BIOS is found |
| `MAME_KEEP=1` | Keep each test's temp folder (ROM, generated Lua, results) and print its path |

### How it works

1. `mame/mame.ts` builds the test's project with the app's code generator and `WasiBuilder` (signed), and resolves the manifest's `watch` names to addresses with dasm's symbol table.
2. It writes a Lua preamble (the steps as a Lua table, the watch addresses, and an output path) in front of `mame/behaviour.lua`, then runs MAME headless and unthrottled: `-video none -sound none -nothrottle`, with SDL on its dummy video driver. Without the dummy driver, MAME on macOS starts fullscreen and the screen flashes black for every test. It also passes `-noreadconfig` and temp `cfg`/`nvram` folders, so your own MAME settings aren't read or changed.
3. The Lua script waits for the cartridge to take over from the BIOS. Then it plays the steps one frame at a time, with the joystick held through `P1 Up/Down/Left/Right` and `P1 Button 1`. It evaluates `until` conditions itself, because they decide how many frames run. At every `expect` step, and when an `until` step times out, it writes the raw bytes of the named variables.
4. `mame.ts` decodes those bytes and checks them with the same rules as `app/src/harness/behaviour.ts`. A failure reads the same way as one from js7800, for example `At frame 124: lives is 3, expected 4`.

Frame 0 is the end of the first frame in which the cartridge runs. js7800 starts the cartridge at reset, with no BIOS, so the two runners' frame numbers line up to within a frame.

## Accuracy findings

How the template tests compare between js7800 and MAME 0.289 (stub BIOS), with fixed-shooter at 0.2.0.

**Every test passes in both.** No test passes in js7800 and fails in MAME.

Frames each test ran before it finished:

| Test | js7800 | MAME | |
| --- | ---: | ---: | --- |
| animation.json | 37 | 36 | `until` ends one frame earlier |
| game-over.json | 1201 | 891 | Bombs hit 310 frames sooner |
| hit.json | 1047 | 737 | Bombs hit 310 frames sooner |
| invincible.json | 3007 | 3007 | Same |
| lives-setting.json | 9 | 9 | Same |
| scoring.json | 165 | 165 | Same |
| start.json | 124 | 124 | Same |
| wave.json | 2025 | 2025 | Same |

- **Bomb timing differs.** In `hit.json` and `game-over.json`, the first bomb hit comes 310 frames earlier in MAME. Bomb drops use `rnd = rand`, so the random sequence (or the frame it's drawn on) differs between the emulators. Likely causes are the power-on RAM contents or CPU timing within a frame. Tests that wait with `until` absorb this. A test that expects a hit on an exact frame would pass in one emulator and fail in the other. Don't write tests that depend on random timing.
- **Enemy animation is one frame out of phase.** The `until` step in `animation.json` finishes one frame sooner in MAME. That's within the sub-frame difference in where frame 0 starts, but it could also be a real timing difference. Keep animation expectations to "it alternates", not exact frame numbers.
- Not yet compared: the real BIOS. It runs before the cartridge and may leave RAM and timing different again. Run with `MAME_ROMPATH` set to check.
