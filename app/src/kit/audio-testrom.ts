// A small 7800basic program for testing the music player on its own, in
// js7800 (audio-rom.test.ts) and MAME (harness/mame/audio-mame.test.ts).

import { soundData } from "../codegen/generate.ts";
import { SOUND_LIBRARY } from "../project/templates.ts";
import { musicIncludeForTunes, type Tune } from "./audio.ts";

/** Fire plays the next tune, down stops the music, up plays a sound effect. */
export function testProgram(tunes: Tune[]): string {
  const inc = musicIncludeForTunes(tunes);
  const boom = SOUND_LIBRARY.find((s) => s.id === "boom")!;
  return ` displaymode 160A
 set romsize 32k
 set pausesilence on
 autodim init var0 var99
 autodim byte loopslo
 autodim byte loopshi
 autodim byte fireheld
 autodim byte nexttune
${inc.vars}
 BACKGRND = $00
 nexttune = 0
 clearscreen
main
 drawscreen
 loopslo = loopslo + 1
 if loopslo = 0 then loopshi = loopshi + 1
 if !joy0fire then fireheld = 0
 if joy0fire && fireheld = 0 then fireheld = 1 : musictune = nexttune : gosub musicplay : nexttune = nexttune + 1
 if joy0down then gosub musicstop
 if joy0up then playsfx sfx_boom
 goto main
${inc.code}
${soundData("sfx_boom", boom)}
`;
}
