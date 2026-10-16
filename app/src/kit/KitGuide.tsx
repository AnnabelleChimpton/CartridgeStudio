// Getting started: three steps from a starter game to playing your own
// ("Draw your hero", "Play it on the TV", and if you like "Change a rule"),
// then a few ideas for that starter. Each step opens the place to do it and ticks itself off.
// It sits in the page (no focus trap); progress is announced politely.

import { forwardRef } from "react";
import { GUIDE_STEPS, type GuideStep } from "./guide.ts";
import type { KitIdea, KitTab } from "./presets.ts";

const STEPS: Record<GuideStep, { title: string; detail: (hero: string) => string; go: string; done: string }> = {
  draw: {
    title: "Draw your hero",
    detail: (hero) => `Click squares to change how the ${hero} looks. Pick a color first; right-click rubs out.`,
    go: "Draw",
    done: "Your hero has your drawing.",
  },
  tv: {
    title: "Play it on the TV",
    detail: () => "With a laptop plugged into the TV, this fills the screen. Play with the keyboard or a gamepad: Start pauses, Select plays again, and holding Select comes back.",
    go: "Play",
    done: "You played your own game!",
  },
  rule: {
    title: "Change a rule (if you like)",
    detail: () => "Rules say what happens, as sentences. Change any underlined word, like how many points something is worth.",
    go: "Rules",
    done: "You changed how your game plays.",
  },
};

export const GUIDE_TAB: Partial<Record<GuideStep, KitTab>> = { draw: "things", rule: "rules" };

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
        <h2 id="kit-guide-h">{current ? "Make it yours in 3 steps" : "You made a game!"}</h2>
        <button type="button" className="link" onClick={onClose}>
          Hide guide
        </button>
      </div>
      {!current && <p className="small">Show it off: Send to family makes one file anyone can play, and Make a clip records a GIF.</p>}
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
                <span className="muted small">{isDone ? step.done : step.detail(hero)}</span>
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
  return `${STEPS[step].done}${next ? ` Next: ${STEPS[next].title}.` : " All three steps done."}`;
}
