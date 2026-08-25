"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, CircleCheck, Eye, UserRoundCheck } from "lucide-react";
import clsx from "clsx";
import { DEMO_EXAMPLES, type DemoExample } from "@/lib/demoExamples";
import { riseIn, riseInStill, stagger } from "@/lib/motion";

/**
 * The golden path.
 *
 * Human review and shadow mode are the two things about ARIE worth showing,
 * and both were previously reachable only by knowing which name to type into a
 * form. Each card runs its example directly, so a visitor who reads nothing
 * else still sees all three outcomes.
 */
const ICON = {
  qualify: CircleCheck,
  human: UserRoundCheck,
  shadow: Eye,
} as const;

const TONE = {
  qualify: { text: "text-qualify", rail: "bg-qualify", edge: "hover:border-qualify-edge" },
  human: { text: "text-human", rail: "bg-human", edge: "hover:border-human-edge" },
  shadow: { text: "text-shadow-role", rail: "bg-shadow-role", edge: "hover:border-shadow-edge" },
} as const;

export function DemoCards() {
  const reduced = useReducedMotion();
  return (
    <motion.ul
      variants={stagger(0.06)}
      initial="hidden"
      animate="show"
      className="grid gap-3 sm:grid-cols-3"
    >
      {DEMO_EXAMPLES.map((example) => (
        <Card key={example.id} example={example} reduced={!!reduced} />
      ))}
    </motion.ul>
  );
}

function Card({ example, reduced }: { example: DemoExample; reduced: boolean }) {
  const Icon = ICON[example.tone];
  const tone = TONE[example.tone];

  return (
    <motion.li variants={reduced ? riseInStill : riseIn} className="min-w-0">
      <Link
        href={`/leads/new?run=${example.id}`}
        className={clsx(
          "surface-flat group relative flex h-full flex-col overflow-hidden p-5",
          "transition-[border-color,background-color,transform] duration-[180ms]",
          "ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:bg-surface-2",
          tone.edge,
        )}
      >
        <span aria-hidden className={clsx("absolute inset-x-0 top-0 h-[2px]", tone.rail)} />

        <span className="flex items-center gap-2">
          <Icon aria-hidden className={clsx("h-4 w-4", tone.text)} strokeWidth={2.25} />
          <span className={clsx("t-label", tone.text)}>{example.outcome}</span>
        </span>

        <h3 className="t-h3 mt-3 text-text">{example.headline}</h3>
        <p className="mt-2 text-[0.8125rem] leading-relaxed text-text-dim">{example.blurb}</p>

        <span className="mt-auto flex items-center gap-1.5 pt-5 text-sm font-medium text-text">
          Run this example
          <ArrowRight
            aria-hidden
            className="h-3.5 w-3.5 transition-transform duration-[180ms] group-hover:translate-x-0.5"
            strokeWidth={2.25}
          />
        </span>
      </Link>
    </motion.li>
  );
}

/** The four steps a visitor is about to go through, stated before they start
 * so the console reads as a demonstration rather than a tool they are expected
 * to already know how to drive. */
export function DemoSteps() {
  const steps = [
    "Pick one of the three examples",
    "Watch ARIE buy evidence",
    "See it stop, and why",
    "Read the Decision Receipt",
  ];
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
      {steps.map((step, i) => (
        <li key={step} className="flex items-center gap-2">
          <span className="flex items-center gap-1.5">
            <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border border-border-strong text-[0.625rem] text-text-faint">
              {i + 1}
            </span>
            <span className="text-[0.8125rem] text-text-dim">{step}</span>
          </span>
          {i < steps.length - 1 && (
            <span aria-hidden className="text-text-faint">
              →
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
