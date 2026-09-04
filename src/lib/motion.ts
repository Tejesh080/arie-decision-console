import type { Transition, Variants } from "motion/react";

/**
 * One motion vocabulary for the whole app.
 *
 * Four bands, and every animation in the product picks one:
 *
 *   FAST      ~140ms  colour, opacity, press feedback
 *   UI        ~200ms  interactive response — hover lift, chip swap
 *   SPATIAL   ~380ms  something moved or reflowed
 *   CINEMATIC ~640ms  a scene changed: hero, section, investigation state
 *
 * Springs are used for anything you touch, eased transforms for anything
 * spatial. Every spring here is critically damped — no visible second
 * oscillation. An instrument that bounces reads as a toy.
 */

export const DURATION = {
  fast: 0.14,
  ui: 0.2,
  spatial: 0.38,
  cine: 0.64,
  /** @deprecated use `ui` */
  base: 0.2,
  /** @deprecated use `spatial` */
  slow: 0.38,
  page: 0.26,
} as const;

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

/** Interactive feedback — hover lifts, tap compressions, badge swaps. */
export const SPRING_SNAP: Transition = {
  type: "spring",
  stiffness: 520,
  damping: 38,
  mass: 0.7,
};

/** The press itself: faster and tighter than SNAP, so a button feels like
 * it has a real travel distance rather than a delay. */
export const SPRING_PRESS: Transition = {
  type: "spring",
  stiffness: 700,
  damping: 34,
  mass: 0.5,
};

/** Layout animation — accordions, list reflow, shared-element moves. */
export const SPRING_LAYOUT: Transition = {
  type: "spring",
  stiffness: 320,
  damping: 34,
  mass: 0.9,
};

/** Long travel across a large distance — a marker crossing a threshold, a
 * rail filling. Slower and softer so the eye can follow the journey. */
export const SPRING_TRAVEL: Transition = {
  type: "spring",
  stiffness: 110,
  damping: 22,
  mass: 1,
};

/** Pointer-tracking parallax: soft enough not to jitter, damped enough
 * never to overshoot. */
export const SPRING_TILT: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 32,
  mass: 0.6,
};

/** Standard content entrance: a short rise + fade. Used by page sections. */
export const riseIn: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.spatial, ease: EASE_OUT },
  },
};

/** A heavier entrance for a scene rather than an element: rises further and
 * settles from slightly back, so a hero or a result set arrives instead of
 * simply appearing. */
export const arriveIn: Variants = {
  hidden: { opacity: 0, y: 22, scale: 0.985 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: DURATION.cine, ease: EASE_OUT },
  },
};

/** Parent that staggers `riseIn`/`arriveIn` children into view. */
export const stagger = (gap = 0.055, delay = 0): Variants => ({
  hidden: {},
  show: {
    transition: { staggerChildren: gap, delayChildren: delay },
  },
});

/**
 * Reduced-motion equivalents. Returned instead of the real variants when
 * `useReducedMotion()` is true.
 *
 * Critically, `hidden` here is *identical* to the animated variants'
 * `hidden`. `useReducedMotion()` is always `false` during SSR (there is no
 * `matchMedia` on the server) and may be `true` on the client, so any
 * variant set whose *initial* values differ between the two makes the
 * server and client render different HTML — a hydration mismatch that only
 * ever fires for the users who asked for less motion. Same starting state,
 * zero-duration finish: no mismatch, and no animation.
 */
export const riseInStill: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0 } },
};

export const arriveInStill: Variants = {
  hidden: { opacity: 0, y: 22, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0 } },
};

export function entrance(reduced: boolean | null): Variants {
  return reduced ? riseInStill : riseIn;
}

export function arrival(reduced: boolean | null): Variants {
  return reduced ? arriveInStill : arriveIn;
}

export function travel(reduced: boolean | null): Transition {
  return reduced ? { duration: 0 } : SPRING_TRAVEL;
}

/** Standard viewport config for scroll-revealed sections: fires once, when
 * a third of the block is on screen. */
export const REVEAL_VIEWPORT = { once: true, amount: 0.3 } as const;
