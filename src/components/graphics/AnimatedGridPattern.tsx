"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import clsx from "clsx";

/**
 * A field of squares that fade in and drift out, scattered across a grid —
 * the Magic UI `AnimatedGridPattern` pattern, adapted to ARIE's signal
 * palette. This is what gives the hero background presence instead of
 * reading as an empty black rectangle: it's the same "market ARIE watches"
 * idea as `AmbientField`'s static lattice, but alive.
 *
 * Cheap by construction: a fixed number of SVG rects animating only
 * `opacity`, no filters, no DOM growth — not "hundreds of particles," a few
 * dozen at most.
 */
export function AnimatedGridPattern({
  width = 42,
  height = 42,
  numSquares = 40,
  maxOpacity = 0.28,
  duration = 3.5,
  className,
}: {
  width?: number;
  height?: number;
  numSquares?: number;
  maxOpacity?: number;
  duration?: number;
  className?: string;
}) {
  const id = useId();
  const reduced = useReducedMotion();
  const containerRef = useRef<SVGSVGElement>(null);
  const [squares, setSquares] = useState<{ id: number; x: number; y: number }[]>([]);

  // A single effect subscribing to the element's size: the resize observer
  // is the external system, and its callback is where `setSquares` belongs
  // — computing the layout in a *second* effect keyed off a `dims` state
  // set by the first would cascade one render into another for no reason.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width: w, height: h } = entry.contentRect;
      if (w === 0 || h === 0) return;
      const cols = Math.max(1, Math.floor(w / width));
      const rows = Math.max(1, Math.floor(h / height));
      const cells = Array.from({ length: cols * rows }, (_, i) => i);
      // Shuffled per resize, not from module-scope `Math.random()` — this
      // only ever runs client-side (inside the observer callback), so it
      // never desyncs from a server-rendered first paint.
      const picked = cells
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(numSquares, cells.length))
        .map((cell, i) => ({
          id: i,
          x: (cell % cols) * width,
          y: Math.floor(cell / cols) * height,
        }));
      setSquares(picked);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [width, height, numSquares]);

  return (
    <svg
      ref={containerRef}
      aria-hidden
      className={clsx("absolute inset-0 h-full w-full", className)}
    >
      <defs>
        <pattern id={id} width={width} height={height} patternUnits="userSpaceOnUse">
          <path
            d={`M ${width} 0 L 0 0 0 ${height}`}
            fill="none"
            stroke="var(--qualify)"
            strokeOpacity="0.06"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
      {!reduced &&
        squares.map(({ id: squareId, x, y }) => (
          <motion.rect
            key={squareId}
            width={width - 1}
            height={height - 1}
            x={x + 0.5}
            y={y + 0.5}
            rx="3"
            fill="var(--qualify)"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, maxOpacity, 0] }}
            transition={{
              duration,
              repeat: Infinity,
              delay: (squareId % 10) * (duration / 8),
              ease: "easeInOut",
            }}
          />
        ))}
    </svg>
  );
}
