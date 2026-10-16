// Picks the game's music: one tune for each moment, from the fixed library
// (src/kit/audio.ts), with a button to hear each before choosing. Not wired
// into the kit editor yet; the kit v2 schema will hold the choices.
//
// The preview doesn't build a ROM. It runs the player's own logic
// (MusicPlayerModel, which the ROM tests hold to the real 6502 player) and
// feeds the register values to a small TIA sound generator, so what you hear
// is the console's pitches, buzz and noise, at once and offline.

import { useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon.tsx";
import { JINGLE_KINDS, JINGLE_MOMENTS, MUSIC_LIBRARY, compileTune, type JingleKind, type MusicChoices } from "./audio.ts";
import { synthesize } from "./tia-synth.ts";

const HINTS: Record<JingleKind, string> = {
  start: "Plays as each game begins.",
  lose: "Plays when the player loses a life.",
  win: "Plays when a level is cleared or the game is won.",
  over: "Plays when the last life is gone.",
  title: "Repeats on the title screen until the game starts.",
};

/** A tune's length as the player plays it, e.g. "2.4 s". */
const seconds = (id: string) => {
  const tune = MUSIC_LIBRARY.find((t) => t.id === id);
  return tune ? `${(compileTune(tune).frames / 60).toFixed(1)} s` : "";
};

/** One preview at a time, through one shared audio context. */
function usePreview() {
  const ctx = useRef<AudioContext | null>(null);
  const source = useRef<AudioBufferSourceNode | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  const stop = () => {
    source.current?.stop();
    source.current = null;
    setPlaying(null);
  };

  const play = (id: string) => {
    const tune = MUSIC_LIBRARY.find((t) => t.id === id);
    if (!tune) return;
    stop();
    ctx.current ??= new AudioContext();
    const { samples, rate } = synthesize(compileTune(tune));
    const buffer = ctx.current.createBuffer(1, samples.length, rate);
    buffer.copyToChannel(samples, 0);
    const node = ctx.current.createBufferSource();
    node.buffer = buffer;
    node.loop = tune.kind === "title";
    const gain = ctx.current.createGain();
    gain.gain.value = 0.6;
    node.connect(gain).connect(ctx.current.destination);
    node.onended = () => {
      if (source.current === node) {
        source.current = null;
        setPlaying(null);
      }
    };
    void ctx.current.resume();
    node.start();
    source.current = node;
    setPlaying(id);
  };

  useEffect(
    () => () => {
      source.current?.stop();
      void ctx.current?.close();
    },
    [],
  );

  return { playing, play, stop };
}

export function JinglePicker({ value, onChange }: { value: MusicChoices; onChange: (next: MusicChoices) => void }) {
  const { playing, play, stop } = usePreview();

  const choose = (kind: JingleKind, id: string) => {
    const next = { ...value };
    if (id) next[kind] = id;
    else delete next[kind];
    onChange(next);
    if (id) play(id);
    else stop();
  };

  return (
    <div className="field-grid">
      {JINGLE_KINDS.map((kind) => {
        const id = value[kind] ?? "";
        const tune = MUSIC_LIBRARY.find((t) => t.id === id);
        const label = JINGLE_MOMENTS[kind][0]!.toUpperCase() + JINGLE_MOMENTS[kind].slice(1);
        return (
          <div className="field" key={kind}>
            <span id={`jingle-${kind}`}>{label}</span>
            <span style={{ display: "flex", gap: "var(--s-2)", alignItems: "center" }}>
              <select aria-labelledby={`jingle-${kind}`} value={id} onChange={(e) => choose(kind, e.target.value)}>
                <option value="">None</option>
                {MUSIC_LIBRARY.filter((t) => t.kind === kind).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!id}
                aria-pressed={playing === id && !!id}
                onClick={() => (playing === id ? stop() : play(id))}
              >
                <Icon name={playing === id && id ? "pause" : "play"} />
                <span>{playing === id && id ? "Stop tune" : "Play tune"}</span>
              </button>
            </span>
            <span className="muted small">
              {tune ? `${tune.blurb} ${seconds(tune.id)}${kind === "title" ? ", then repeats" : ""}.` : HINTS[kind]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
