import type { Transition, Variants } from "motion/react";

/**
 * One motion vocabulary for the whole app.
 *
 * The governing feel is *critically damped*: fast in, settles immediately,
 * never overshoots. An instrument that bounces reads as a toy, so no spring
 * here has a visible second oscillation (every one is bounce <= 0).
 *
 * Durations sit in the 130–420ms band. Anything slower than ~450ms starts to
 * feel like the app is thinking rather than responding.
 */

/** Interactive feedback — hover lifts, tap compressions, badge swaps. */
export const SPRING_SNAP: Transition = {
  type: "spring",
  stiffness: 520,
  damping: 38,
  mass: 0.7,
};

/** Layout animation — accordions, list reflow, shared-element moves. */
export const SPRING_LAYOUT: Transition = {
  type: "spring",
  stiffness: 320,
  damping: 34,
  mass: 0.9,
};

/** Long travel across a large distance — a confidence marker crossing tau,
 * a rail filling. Slower and softer so the eye can follow the journey. */
export const SPRING_TRAVEL: Transition = {
  type: "spring",
  stiffness: 110,
  damping: 22,
  mass: 1,
};

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export const DURATION = {
  fast: 0.13,
  base: 0.2,
  slow: 0.34,
  page: 0.26,
} as const;

/** Standard content entrance: a short rise + fade. Used by page sections. */
export const riseIn: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.slow, ease: EASE_OUT },
  },
};

/** Parent that staggers `riseIn` children into view. */
export const stagger = (gap = 0.055, delay = 0): Variants => ({
  hidden: {},
  show: {
    transition: { staggerChildren: gap, delayChildren: delay },
  },
});

/**
 * Reduced-motion equivalents. Returned instead of the real variants when
 * `useReducedMotion()` is true, so the element renders its *final* state
 * immediately rather than a near-instant version of the animation.
 */
export const riseInStill: Variants = {
  hidden: { opacity: 1, y: 0 },
  show: { opacity: 1, y: 0 },
};

export function entrance(reduced: boolean | null): Variants {
  return reduced ? riseInStill : riseIn;
}

export function travel(reduced: boolean | null): Transition {
  return reduced ? { duration: 0 } : SPRING_TRAVEL;
}
