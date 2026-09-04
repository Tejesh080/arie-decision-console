"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, CircleCheck, Eye, UserRoundCheck } from "lucide-react";
import clsx from "clsx";
import { DEMO_EXAMPLES, type DemoExample } from "@/lib/demoExamples";
import { REVEAL_VIEWPORT, entrance, stagger } from "@/lib/motion";
import { pointerGlowLeave, pointerGlowMove } from "@/lib/pointerGlow";

/**
 * The golden path.
 *
 * Human review and shadow mode are the two things about ARIE worth showing,
 * and both were previously reachable only by knowing which name to type
 * into a form. Each card runs its example directly, so a visitor who reads
 * nothing else still sees all three outcomes.
 */
const ICON = {
  qualify: CircleCheck,
  human: UserRoundCheck,
  shadow: Eye,
} as const;

const TONE = {
  qualify: {
    text: "text-qualify",
    glow: "rgba(79,227,193,0.55)",
    wash: "rgba(79,227,193,0.07)",
  },
  human: {
    text: "text-human",
    glow: "rgba(245,182,92,0.5)",
    wash: "rgba(245,182,92,0.06)",
  },
  shadow: {
    text: "text-shadow-role",
    glow: "rgba(158,134,255,0.5)",
    wash: "rgba(158,134,255,0.06)",
  },
} as const;

export function DemoCards() {
  return (
    <motion.ul
      variants={stagger(0.08)}
      initial="hidden"
      whileInView="show"
      viewport={REVEAL_VIEWPORT}
      className="grid gap-4 sm:grid-cols-3"
    >
      {DEMO_EXAMPLES.map((example) => (
        <Card key={example.id} example={example} />
      ))}
    </motion.ul>
  );
}

function Card({ example }: { example: DemoExample }) {
  const reduced = useReducedMotion();
  const Icon = ICON[example.tone];
  const tone = TONE[example.tone];

  return (
    <motion.li variants={entrance(reduced)} className="min-w-0">
      <Link
        href={`/leads/new?run=${example.id}`}
        onPointerMove={pointerGlowMove}
        onPointerLeave={pointerGlowLeave}
        className={clsx(
          "liquid-surface liquid-edge group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] p-8",
          "transition-[transform,box-shadow] duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
          "hover:-translate-y-1.5 hover:shadow-[0_32px_70px_-24px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.1)]",
          example.tone === "qualify" && "spectral-edge",
        )}
      >
        {/* The outcome's colour arrives as light on the top edge and a
            wash behind the icon — not as a border around the whole card. */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-px opacity-80 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: `linear-gradient(90deg,transparent,${tone.glow},transparent)` }}
        />
        <span
          aria-hidden
          className="absolute -top-28 left-1/2 h-56 w-72 -translate-x-1/2 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: `radial-gradient(circle, ${tone.wash}, transparent 70%)` }}
        />

        <span
          aria-hidden
          className="absolute inset-[-10px] -z-10 rounded-full opacity-60 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background: `radial-gradient(circle, ${tone.wash}, transparent 72%)`,
            maskImage: "radial-gradient(24px 24px at 44px 44px, black, transparent 80%)",
            WebkitMaskImage: "radial-gradient(24px 24px at 44px 44px, black, transparent 80%)",
          }}
        />
        <span
          className={clsx(
            "liquid-surface liquid-edge flex h-14 w-14 items-center justify-center rounded-2xl transition-transform duration-500 group-hover:scale-[1.08]",
            tone.text,
          )}
        >
          <Icon aria-hidden className="h-6 w-6" strokeWidth={2} />
        </span>

        <span className={clsx("mt-6 block text-[0.8125rem] font-semibold tracking-[-0.01em]", tone.text)}>
          {example.outcome}
        </span>
        <h3 className="mt-2 text-[1.3125rem] font-semibold tracking-[-0.026em] text-text">
          {example.headline}
        </h3>
        <p className="mt-3.5 text-[0.9375rem] leading-relaxed text-text-dim">{example.blurb}</p>

        <span className="mt-auto flex items-center gap-1.5 pt-8 text-sm font-medium text-text">
          Run this example
          <ArrowRight
            aria-hidden
            className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1"
            strokeWidth={2.25}
          />
        </span>
      </Link>
    </motion.li>
  );
}

/** The four steps a visitor is about to go through, stated before they
 * start so the console reads as a demonstration rather than a tool they are
 * expected to already know how to drive. */
export function DemoSteps() {
  const steps = ["Pick an example", "Watch it gather", "See it stop", "Read the reasoning"];
  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
      {steps.map((step, i) => (
        <li key={step} className="flex items-center gap-1.5">
          <span className="liquid-surface liquid-edge flex items-center gap-2 rounded-full py-1.5 pr-3.5 pl-2">
            <span className="t-data flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[0.5625rem] text-text-faint">
              {i + 1}
            </span>
            <span className="text-[0.8125rem] text-text-dim">{step}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
