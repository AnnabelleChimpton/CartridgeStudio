// Getting started: three steps from a starter game to playing your own
// ("Draw your hero", "Paint the room", "Press Play"), then a few ideas for
// that starter. Each step opens the place to do it and ticks itself off.
// It sits in the page (no focus trap); progress is announced politely.

import { forwardRef } from "react";
import { GUIDE_STEPS, type GuideStep } from "./guide.ts";
import type { KitIdea, KitTab } from "./presets.ts";

const STEPS: Record<GuideStep, { title: string; detail: (hero: string) => string; go: string }> = {
  draw: {
    title: "Draw your hero",
    detail: (hero) => `Click squares to change how the ${hero} looks. Pick a color first; right-click rubs out.`,
    go: "Draw",
  },
  paint: {
    title: "Paint the room",
    detail: () => "Pick a brush, like Wall, then click or drag across the squares.",
    go: "Paint",
  },
  play: {
    title: "Press Play",
    detail: () => "Click the game, then use the arrow keys and Space. A gamepad works too.",
    go: "Play",
  },
};

export const GUIDE_TAB: Partial<Record<GuideStep, KitTab>> = { draw: "things", paint: "room" };

interface Props {
  hero: string;
  done: GuideStep[];
  ideas: KitIdea[];
  onStep: (step: GuideStep) => void;
  onIdea: (idea: KitIdea) => void;
  onClose: () => void;
}

export const KitGuide = forwardRef<HTMLElement, Props>(function KitGuide({ hero, done, ideas, onStep, onIdea, onClose }, ref) {
  const current = GUIDE_STEPS.find((s) => !done.includes(s));
  return (
    <section className="kit-guide" aria-labelledby="kit-guide-h" ref={ref} tabIndex={-1} data-testid="kit-guide">
      <div className="kit-guide-head">
        <h2 id="kit-guide-h">{current ? "Make it yours in 3 steps" : "You made it yours!"}</h2>
        <button type="button" className="link" onClick={onClose}>
          Hide guide
        </button>
      </div>
      <ol className="guide-steps">
        {GUIDE_STEPS.map((s, i) => {
          const isDone = done.includes(s);
          const step = STEPS[s];
          return (
            <li key={s} className={isDone ? "done" : s === current ? "current" : undefined} aria-current={s === current ? "step" : undefined}>
              <span className="guide-num" aria-hidden="true">
                {isDone ? "✓" : i + 1}
              </span>
              <span className="guide-text">
                <strong>
                  {step.title}
                  {isDone && <span className="visually-hidden"> (done)</span>}
                </strong>
                <span className="muted small">{step.detail(hero)}</span>
              </span>
              <button type="button" className={s === current ? undefined : "secondary"} onClick={() => onStep(s)} aria-label={`${step.go}: ${step.title}`}>
                {step.go}
              </button>
            </li>
          );
        })}
      </ol>
      {ideas.length > 0 && (
        <div className="guide-ideas">
          <h3 id="kit-guide-ideas-h">{current ? "Then try this" : "Try this next"}</h3>
          <ul aria-labelledby="kit-guide-ideas-h">
            {ideas.map((idea) => (
              <li key={idea.text}>
                <button type="button" className="link" onClick={() => onIdea(idea)}>
                  {idea.text}
                </button>
                <span className="muted small"> {idea.how}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
});

/** What to announce when a step is ticked off. */
export function guideAnnouncement(step: GuideStep, done: GuideStep[]): string {
  const next = GUIDE_STEPS.find((s) => !done.includes(s));
  return `Done: ${STEPS[step].title}.${next ? ` Next: ${STEPS[next].title}.` : " All three steps done."}`;
}
