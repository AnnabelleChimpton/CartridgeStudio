# Templates

One folder per template. Template code is CC0 so it never encumbers a creator's game.

## A template package

| File | What it is |
| --- | --- |
| `template.json` | Manifest: sprite roles, sizes and animation frames, tunable params with ranges, the rule vocabulary (triggers, actions), sound slots, the `watch` list of game variables for tests, budgets |
| `engine.bas.hbs` | The 7800basic engine as a Handlebars template |
| `actions/<action id>.bas` | One subroutine per action, also rendered with the helpers below. It must define the label `action_<id with dots as underscores>` and end with `return` |
| `sample.json` | The starter project a creator gets when they pick the template |
| `tests/*.json` | Behaviour tests: scripted input and expected game variables (see below) |

Shared by all templates: `sfx/library.json`, the TIA sound effects that sound slots pick from (7800basic `playsfx` format: frequency, control, volume per chunk).

The code generator (`app/src/codegen/`) only fills the template's helpers, so creators can't produce code the template author didn't anticipate:

| Helper | Output |
| --- | --- |
| `{{param "id"}}` | The param's value, clamped to the manifest range and snapped to its step |
| `{{subtract a b}}` | `a - b`, for deriving constants |
| `{{palette "role"}}` | The palette register index (0–7) of the sprite with that role |
| `{{incgraphics}}` | `incgraphic` lines for every sprite frame, in order: `enemy.png`, `enemy_1.png`, ... so `plotsprite enemy p x y frame` animates |
| `{{sound "slot"}}` | ` playsfx sfx_<slot>`, or a `rem` when the project picked no sound |
| `{{soundData}}` | The `data sfx_<slot>` blocks for every sound used. Must come after every `{{sound}}`, so put it last |
| `{{paletteRegisters}}` | `PnC1..3` assignments for every project palette |
| `{{background}}` | The background color, for example `$00` |
| `{{#hook "name"}}default{{/hook}}` | The `gosub` lines for the rules whose trigger uses this hook, each with a comment naming the rule. Without such rules, the block's own content |
| `{{actions}}` | The snippets of every action the rules use |
| `{{title}}`, `{{templateVersion}}`, `{{romSize}}` | Project title (sanitized), template version, ROM size |

## Versions and upgrades

Bump `version` whenever the manifest changes what a project must contain (roles, frames, slots). Add a step to `app/src/project/upgrades.ts` that brings a project from the previous version forward without losing the creator's work. Saved projects are upgraded on load.

## Behaviour tests

Each `tests/*.json` file is run by `app/src/harness/template-behaviour.test.ts` against the headless js7800 core, frame by frame:

```json
{
  "name": "a bomb hit loses a life",
  "project": { "params": { "bombRate": 20 } },
  "steps": [
    { "frames": 5 },
    { "hold": ["fire"], "frames": 2 },
    { "until": { "lives": 2 }, "maxFrames": 6000, "steps": [{ "frames": 10 }] },
    { "expect": { "state": 1 } }
  ]
}
```

- `project` changes the sample: `params` and `sounds` merge, `rules` replace.
- Steps:
  - `{ hold, frames }` holds inputs (`up`, `down`, `left`, `right`, `fire`) for that many frames, then releases them.
  - `{ repeat, steps }` runs steps a number of times.
  - `{ until, maxFrames, steps }` repeats steps until a condition holds, and fails after `maxFrames`.
  - `{ expect }` checks a condition.
- Conditions name variables from the manifest's `watch` list, never engine symbols directly. Each takes a number or `{ eq, ne, gt, gte, lt, lte, multipleOf }`.
- `app/src/harness/fuzz.test.ts` also builds random valid projects and checks that each keeps running for 600 frames. Set `FUZZ_COUNT` to run more, and `FUZZ_SEED` to replay one.

## 7800basic 0.41 pitfalls

These were found while writing `fixed-shooter`. The code generator's lint catches 1, 2 and 6.

1. **Never multiply by a const name** (`x = col * COLSPACING`). The compiler loops forever. Multiply by a literal instead (`col * 20`).
2. **Never pass a const as a `plotsprite` or `boxcollision` position.** The value is read from the zero-page address with that number instead of being used as the number. Copy it into a variable first (`ey = PLAYERY`).
3. `boxcollision` widths and heights must be numbers, not variables.
4. Set `characterset <font>` before `plotvalue`. Otherwise digits are fetched from the wrong memory.
5. `if rand < n` doesn't re-roll the random number. Assign it first (`rnd = rand`).
6. **Score math takes a const's value as-is.** `score0 = score0 + 30` adds BCD `$30`, but with `const P = 30`, `score0 = score0 + P` adds binary 30 and corrupts the score. Write score consts in BCD (`const P = $30`). The template tests lint for this too.
