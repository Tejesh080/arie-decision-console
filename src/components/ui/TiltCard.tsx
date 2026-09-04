"use client";

import { useRef, type PointerEvent, type ReactNode } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";

const TILT_SPRING = { stiffness: 300, damping: 32, mass: 0.6 };

/**
 * A few degrees of pointer-parallax — spring-damped to a stop with no
 * overshoot, matching this app's whole motion contract (`lib/motion.ts`:
 * "no spring here has a visible second oscillation"). Off under reduced
 * motion and on touch, since there's no persistent hover to drive it.
 */
export function TiltCard({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(py, [0, 1], [7, -7]), TILT_SPRING);
  const rotateY = useSpring(useTransform(px, [0, 1], [-7, 7]), TILT_SPRING);

  function handleMove(event: PointerEvent<HTMLDivElement>) {
    if (reduced || event.pointerType === "touch") return;
    const rect = event.currentTarget.getBoundingClientRect();
    px.set((event.clientX - rect.left) / rect.width);
    py.set((event.clientY - rect.top) / rect.height);
  }

  function handleLeave() {
    px.set(0.5);
    py.set(0.5);
  }

  return (
    <motion.div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      style={{
        rotateX: reduced ? 0 : rotateX,
        rotateY: reduced ? 0 : rotateY,
        transformPerspective: 1000,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
