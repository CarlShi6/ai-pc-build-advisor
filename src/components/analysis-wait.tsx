import { useEffect, useState } from "react";

/** What the model reads, in the order it is shown; one request, so the steps follow the clock. */
export const ANALYSIS_STEPS = [
  "Reading the case",
  "Reading the graphics card",
  "Reading the cooler and fans",
  "Reading memory and motherboard",
  "Reading visible text for model guesses",
  "Checking the reading for contradictions",
] as const;
const STEP_SECONDS = 6;

/**
 * The wait while a photo is analyzed (about 35 s with gpt-5.4): elapsed time and the step the
 * model is likely on, never a blank spinner. The steps are a guide, not live progress.
 */
export function AnalysisWait() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);
  const current = Math.min(ANALYSIS_STEPS.length - 1, Math.floor(seconds / STEP_SECONDS));
  return (
    <div className="v3-analysis-wait" role="status" aria-live="polite">
      <p className="v3-analysis-status">
        {ANALYSIS_STEPS[current]}… <span>{seconds} s</span>
      </p>
      <ol>
        {ANALYSIS_STEPS.map((step, index) => (
          <li
            key={step}
            className={index < current ? "done" : index === current ? "current" : undefined}
            aria-current={index === current ? "step" : undefined}
          >
            {step}
          </li>
        ))}
      </ol>
      <small>
        A careful read usually takes 30–40 seconds. The steps show what is being read, not live
        progress.
      </small>
    </div>
  );
}
