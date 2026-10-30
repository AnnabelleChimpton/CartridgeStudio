import { Fragment, forwardRef, useState } from "react";
import { GUIDE_STEPS, type GuideStep } from "./guide.ts";
import type { KitIdea } from "./presets.ts";

const STEPS: Record<GuideStep, { text: (hero: string) => string; go: string; done: (hero: string) => string }> = {
  draw: {
    text: (hero) => `Draw your ${hero}. Pick a colour, click squares.`,
    go: "Draw",
    done: (hero) => `Your ${hero} has your drawing.`,
  },
  tv: {
    text: () => "Play it full screen.",
    go: "Full screen",
    done: () => "Played full screen.",
  },
  rule: {
    text: () => "Change a rule.",
    go: "Rules",
    done: () => "Rule changed.",
  },
};

interface Props {
  title: string;
  hero: string;
  done: GuideStep[];
  ideas: KitIdea[];
  onStep: (step: GuideStep) => void;
  onIdea: (idea: KitIdea) => void;
  onClose: () => void;
}

/** One row above the tabs: the current step and its button, then the starter's ideas once all three are done. */
export const KitGuide = forwardRef<HTMLElement, Props>(function KitGuide({ title, hero, done, ideas, onStep, onIdea, onClose }, ref) {
  const [tried, setTried] = useState<string[]>([]);
  const current = GUIDE_STEPS.find((s) => !done.includes(s));
  if (!current && ideas.length === 0) return null;
  return (
    <section className="guide-strip" aria-label="Guide" ref={ref} tabIndex={-1} data-testid="kit-guide">
      {current ? (
        <>
          <span className="guide-count">{GUIDE_STEPS.indexOf(current) + 1} of 3</span>
          <span className="guide-text">{STEPS[current].text(hero)}</span>
          <button type="button" onClick={() => onStep(current)}>
            {STEPS[current].go}
          </button>
        </>
      ) : (
        <span className="guide-text">
          Ideas for {title.trim() || "Untitled"}:{" "}
          {ideas.map((idea, i) => (
            <Fragment key={idea.text}>
              {i > 0 && <span aria-hidden="true"> · </span>}
              <button
                type="button"
                className="link"
                onClick={() => {
                  setTried((t) => (t.includes(idea.text) ? t : [...t, idea.text]));
                  onIdea(idea);
                }}
              >
                {idea.text}
              </button>
              {tried.includes(idea.text) && <span className="muted"> {idea.how}</span>}
            </Fragment>
          ))}
        </span>
      )}
      <button type="button" className="link guide-hide" onClick={onClose}>
        Hide guide
      </button>
    </section>
  );
});

/** What to announce when a step is ticked off. */
export function guideAnnouncement(step: GuideStep, done: GuideStep[], hero: string): string {
  const next = GUIDE_STEPS.find((s) => !done.includes(s));
  return `${STEPS[step].done(hero)}${next ? ` Next: ${STEPS[next].text(hero)}` : " That was the last step."}`;
}
