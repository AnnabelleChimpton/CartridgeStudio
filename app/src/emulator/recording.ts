// Recording the joystick for creator tests (code/creator-tests.ts): the
// emulator worker notes which controls were held for each frame it runs,
// from power-on, as runs of identical frames.

import type { JoystickInput } from "./core-host.ts";
import type { Recording } from "./protocol.ts";

export const newRecording = (): Recording => ({ frames: 0, runs: [] });

/** Adds `n` frames with `held` held. */
export function noteFrames(rec: Recording, held: JoystickInput, n: number) {
  const hold = (Object.keys(held) as (keyof JoystickInput)[]).filter((k) => held[k]).sort();
  const last = rec.runs.at(-1);
  if (last && last.hold.join() === hold.join()) last.frames += n;
  else rec.runs.push({ hold, frames: n });
  rec.frames += n;
}
