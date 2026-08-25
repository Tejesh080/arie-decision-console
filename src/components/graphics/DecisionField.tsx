"use client";

import { motion, useReducedMotion } from "motion/react";
import { EASE_OUT } from "@/lib/motion";

/**
 * The hero schematic: ARIE's mechanism drawn as one figure.
 *
 * Evidence arrives from the left and converges into a single confidence
 * path. The path rises as evidence accumulates, crosses the autonomy
 * threshold (tau), and resolves into one of three routes. The whole product
 * thesis — *stop acquiring once confidence clears tau* — is the geometry.
 *
 * This is a schematic of the mechanism, not a plot of live data, and is
 * labelled as such in the markup. It is `aria-hidden`: everything it says
 * is said in prose beside it, so a screen reader gets the argument without
 * having to parse an SVG.
 *
 * Animation is one-shot on mount (no loop), draws with `pathLength`, and
 * renders its finished state immediately under reduced motion.
 */

const EVIDENCE = [
  { x: 34, y: 74, delay: 0 },
  { x: 58, y: 122, delay: 0.08 },
  { x: 30, y: 170, delay: 0.16 },
  { x: 62, y: 218, delay: 0.24 },
  { x: 36, y: 266, delay: 0.32 },
  { x: 54, y: 312, delay: 0.4 },
];

const HUB = { x: 196, y: 196 };
const TAU_X = 330;
const RESOLVED = { x: 396, y: 118 };

/** The confidence path: flat while evidence is thin, then rising steeply as
 * it accumulates, flattening again once it has cleared the threshold. */
const CONFIDENCE_PATH = `M ${HUB.x} ${HUB.y} C 250 194, 268 168, 300 146 S 356 112, ${RESOLVED.x} ${RESOLVED.y}`;

const ROUTES = [
  { y: 86, label: "Autonomous", color: "var(--qualify)", active: true },
  { y: 134, label: "Human review", color: "var(--human)", active: false },
  { y: 182, label: "Shadow", color: "var(--shadow-role)", active: false },
];

export function DecisionField({ className }: { className?: string }) {
  return (
    <div className={className}>
      <DecisionFieldSvg className="h-auto w-full" />
      {/* The route legend, in HTML rather than <text>, so it stays crisp and
          selectable at any width instead of scaling down with the drawing. */}
      <ul className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2 pl-1">
        {ROUTES.map((route) => (
          <li key={route.label} className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: route.color, opacity: route.active ? 1 : 0.4 }}
            />
            <span
              className="t-label"
              style={{ color: route.active ? route.color : "var(--text-faint)" }}
            >
              {route.label}
            </span>
            {route.active && <span className="t-label text-text-faint">— taken</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DecisionFieldSvg({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  // Under reduced motion every element starts at its finished value, so the
  // figure is complete on first paint rather than animating very fast.
  const shown = reduced ? { opacity: 1, scale: 1, pathLength: 1 } : undefined;
  const at = (delay: number, duration: number) =>
    reduced ? { duration: 0 } : { duration, delay, ease: EASE_OUT };

  return (
    <svg viewBox="0 0 500 400" fill="none" aria-hidden role="presentation" className={className}>
      <title>Schematic: evidence converging until confidence crosses the autonomy threshold</title>

      <defs>
        <linearGradient id="af-conf" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--machine)" stopOpacity="0.35" />
          <stop offset="60%" stopColor="var(--machine)" stopOpacity="0.95" />
          <stop offset="100%" stopColor="var(--qualify)" stopOpacity="1" />
        </linearGradient>
        <radialGradient id="af-halo">
          <stop offset="0%" stopColor="var(--qualify)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--qualify)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="af-feed" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--border-loud)" stopOpacity="0.15" />
          <stop offset="100%" stopColor="var(--machine)" stopOpacity="0.55" />
        </linearGradient>
      </defs>

      {/* Baseline — the "no evidence yet" floor the path lifts away from. */}
      <line
        x1="24"
        y1={HUB.y}
        x2="470"
        y2={HUB.y}
        stroke="var(--border)"
        strokeWidth="1"
        strokeDasharray="2 5"
      />

      {/* Evidence feeds converging on the hub. */}
      {EVIDENCE.map((node, i) => (
        <motion.path
          key={`feed-${i}`}
          d={`M ${node.x + 7} ${node.y} Q ${(node.x + HUB.x) / 2} ${node.y}, ${HUB.x} ${HUB.y}`}
          stroke="url(#af-feed)"
          strokeWidth="1"
          initial={shown ?? { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={at(0.15 + node.delay, 0.7)}
        />
      ))}

      {/* Evidence nodes. Squares, not circles: a discrete record, not a blob. */}
      {EVIDENCE.map((node, i) => (
        <motion.rect
          key={`node-${i}`}
          x={node.x - 3.5}
          y={node.y - 3.5}
          width="7"
          height="7"
          rx="1.5"
          fill="var(--machine)"
          initial={shown ?? { opacity: 0, scale: 0.2 }}
          animate={{ opacity: 0.85, scale: 1 }}
          style={{ transformOrigin: `${node.x}px ${node.y}px` }}
          transition={at(node.delay, 0.35)}
        />
      ))}

      {/* The autonomy threshold. */}
      <motion.g
        initial={shown ?? { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={at(0.55, 0.4)}
      >
        <line
          x1={TAU_X}
          y1="52"
          x2={TAU_X}
          y2="340"
          stroke="var(--human)"
          strokeWidth="1"
          strokeDasharray="4 4"
          opacity="0.75"
        />
        <text
          x={TAU_X + 8}
          y="332"
          fill="var(--text-faint)"
          fontSize="11"
          fontFamily="var(--font-data)"
          letterSpacing="0.12em"
        >
          THRESHOLD
        </text>
      </motion.g>

      {/* Confidence rising through the threshold. */}
      <motion.path
        d={CONFIDENCE_PATH}
        stroke="url(#af-conf)"
        strokeWidth="2.25"
        strokeLinecap="round"
        initial={shown ?? { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={at(0.62, 1.15)}
      />

      {/* Convergence hub. */}
      <motion.circle
        cx={HUB.x}
        cy={HUB.y}
        r="4.5"
        fill="var(--bg)"
        stroke="var(--machine)"
        strokeWidth="1.75"
        initial={shown ?? { opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ transformOrigin: `${HUB.x}px ${HUB.y}px` }}
        transition={at(0.5, 0.35)}
      />

      {/* Resolution: the decision, having cleared tau. */}
      <motion.g
        initial={shown ?? { opacity: 0, scale: 0.4 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ transformOrigin: `${RESOLVED.x}px ${RESOLVED.y}px` }}
        transition={at(1.6, 0.5)}
      >
        <circle cx={RESOLVED.x} cy={RESOLVED.y} r="34" fill="url(#af-halo)" />
        <circle cx={RESOLVED.x} cy={RESOLVED.y} r="6.5" fill="var(--qualify)" />
        <circle
          cx={RESOLVED.x}
          cy={RESOLVED.y}
          r="12"
          stroke="var(--qualify)"
          strokeWidth="1"
          opacity="0.45"
        />
      </motion.g>

      {/* Routes. Only the taken one is drawn solid; the others stay as
          unlit possibilities, which is the honest picture. */}
      {ROUTES.map((route, i) => (
        <motion.g
          key={route.label}
          initial={shown ?? { opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={at(1.75 + i * 0.08, 0.45)}
        >
          <line
            x1={RESOLVED.x + 14}
            y1={route.active ? RESOLVED.y : RESOLVED.y}
            x2="446"
            y2={route.y}
            stroke={route.color}
            strokeWidth={route.active ? 1.5 : 1}
            strokeDasharray={route.active ? undefined : "3 4"}
            opacity={route.active ? 0.85 : 0.28}
          />
          <circle
            cx="452"
            cy={route.y}
            r={route.active ? 4 : 2.75}
            fill={route.color}
            opacity={route.active ? 1 : 0.35}
          />
        </motion.g>
      ))}
    </svg>
  );
}
