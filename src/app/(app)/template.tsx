"use client";

import { motion, useReducedMotion } from "motion/react";
import { DURATION, EASE_OUT } from "@/lib/motion";

/**
 * Page transition. `template.tsx` (rather than `layout.tsx`) is what makes
 * this work: Next remounts a template on every navigation, so the entrance
 * replays per route without needing an exit animation or a route-change
 * listener.
 *
 * Deliberately entrance-only. An exit animation would hold the old page on
 * screen after the click, which makes navigation feel slower than it is —
 * the one thing a transition must never do.
 *
 * Reduced motion changes the *duration*, never the tree or the initial
 * style. `useReducedMotion()` is false during SSR and can be true on the
 * client, so branching the markup here (`if (reduced) return children`)
 * renders a different tree on each side and trips a hydration mismatch for
 * exactly the people who asked for less motion.
 *
 * `initial` is `opacity: 1`, deliberately. This wraps every authenticated
 * route's entire content — if Motion is slow to hydrate, errors, or never
 * runs at all, this SSR's `initial` state is what a visitor is stuck
 * looking at. It must be the real page, not a hidden one. The transition is
 * a small `y` rise only: motion the page can lose without losing content.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 1, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: DURATION.page, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}
