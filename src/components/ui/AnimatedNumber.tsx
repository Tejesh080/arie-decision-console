"use client";

import { useEffect, useRef, useState } from "react";
import { useMotionValue, useReducedMotion, useSpring, useMotionValueEvent } from "motion/react";

const defaultFormat = (n: number) => Math.round(n).toLocaleString();

/**
 * A metric that transitions smoothly when its value *changes*, on a
 * critically-damped spring — the same "settles, never overshoots" contract
 * as every other spring in `lib/motion.ts`.
 *
 * The first render shows the value immediately, with no animation:
 * counting up from zero on every page load reads as a gimmick, not a
 * reading. Only a later change — a dashboard refresh, more leads resolving
 * in the background — animates. Reduced motion always renders plainly.
 */
export function AnimatedNumber({
  value,
  format = defaultFormat,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const motionValue = useMotionValue(value);
  const spring = useSpring(motionValue, { stiffness: 130, damping: 26, mass: 1 });
  const [display, setDisplay] = useState(() => format(value));
  const mounted = useRef(false);

  useMotionValueEvent(spring, "change", (latest) => setDisplay(format(latest)));

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (!reduced) motionValue.set(value);
  }, [value, reduced, motionValue]);

  if (reduced) return <span className={className}>{format(value)}</span>;
  return <span className={className}>{display}</span>;
}
