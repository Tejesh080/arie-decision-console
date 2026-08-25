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
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();

  if (reduced) return <>{children}</>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.page, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}
