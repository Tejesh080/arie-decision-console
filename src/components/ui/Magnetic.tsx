"use client";

import { type PointerEvent, type ReactNode } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";

const SPRING = { stiffness: 300, damping: 22, mass: 0.4 };

/**
 * A few pixels of magnetic attraction toward the pointer. Built on Motion
 * values rather than React state — same contract as `TiltCard` — so hover
 * tracking never triggers a render. Off under reduced motion and touch,
 * where there's no persistent hover to drive it.
 */
export function Magnetic({
  children,
  strength = 8,
  className,
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, SPRING);
  const sy = useSpring(y, SPRING);

  function handleMove(event: PointerEvent<HTMLDivElement>) {
    if (reduced || event.pointerType === "touch") return;
    const rect = event.currentTarget.getBoundingClientRect();
    x.set(((event.clientX - rect.left) / rect.width - 0.5) * strength);
    y.set(((event.clientY - rect.top) / rect.height - 0.5) * strength);
  }

  function handleLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      style={{ x: reduced ? 0 : sx, y: reduced ? 0 : sy }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
