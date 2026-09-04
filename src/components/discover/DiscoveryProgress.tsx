"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import clsx from "clsx";
import { EASE_OUT } from "@/lib/motion";

/**
 * The investigation state.
 *
 * `POST /discovery/runs` runs synchronously and returns only once the whole
 * loop is finished — there is no server-sent progress to render. So this
 * deliberately does *not* tick stages off as if it knew: no checkmarks, no
 * percentage, no fabricated "step 3 of 4 complete".
 *
 * What it shows instead is true: the work a run actually does, in order,
 * with a scan travelling across a dim field, and a real elapsed clock. The
 * reader gets something to watch and a sense of scale without being told
 * anything the browser cannot know.
 */
const STAGES = [
  { label: "Turning your profile into searches", detail: "Queries" },
  { label: "Pulling back companies that match", detail: "Candidates" },
  { label: "Screening them before spending", detail: "First pass" },
  { label: "Checking survivors on their own site", detail: "Verify" },
  { label: "Finding who owns the problem", detail: "Buyer" },
] as const;

/** A dim field with a light moving through it — the hero's motif at the
 * size of a progress bar. Transform-only, so it composites. */
function ScanField() {
  const reduced = useReducedMotion();
  const marks = [6, 14, 21, 29, 37, 44, 52, 59, 67, 74, 82, 90];

  return (
    <div className="relative h-9 overflow-hidden rounded-lg bg-white/[0.02] ring-1 ring-white/[0.05] ring-inset">
      {marks.map((left, i) => (
        <span
          key={left}
          aria-hidden
          className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-[2px] bg-text-faint"
          style={{ left: `${left}%`, opacity: i % 3 === 0 ? 0.4 : 0.16 }}
        />
      ))}
      {!reduced && (
        <motion.span
          aria-hidden
          className="absolute inset-y-0 w-32"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(79,227,193,0.35), transparent)",
          }}
          animate={{ x: ["-8rem", "100%"] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </div>
  );
}

/** Elapsed wall-clock since the panel mounted. The start time is read
 * inside the effect, not during render — the clock is an external system
 * this subscribes to, and reading it while rendering makes the component
 * impure. */
function useElapsed() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => {
      setSeconds(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return seconds;
}

export function DiscoveryProgress() {
  const reduced = useReducedMotion();
  const elapsed = useElapsed();
  const minutes = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return (
    <section
      aria-live="polite"
      className="liquid-surface liquid-edge spectral-edge grain-veil mt-8 overflow-hidden rounded-2xl p-7 sm:p-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5 items-center justify-center">
            <span aria-hidden className="signal-ping absolute h-2.5 w-2.5 rounded-full bg-qualify" />
            <span className="relative h-2.5 w-2.5 rounded-full bg-qualify" />
          </span>
          <h2 className="text-[1.0625rem] font-semibold tracking-[-0.02em] text-text">
            Investigating the market
          </h2>
        </div>
        <p className="t-data text-[0.8125rem] text-text-faint">
          {minutes > 0 ? `${minutes}m ` : ""}
          {String(secs).padStart(minutes > 0 ? 2 : 1, "0")}s elapsed
        </p>
      </div>

      <div className="mt-6">
        <ScanField />
      </div>

      <ol className="mt-6 flex flex-col gap-3.5">
        {STAGES.map((stage, i) => (
          <motion.li
            key={stage.label}
            initial={reduced ? false : { opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={
              reduced ? { duration: 0 } : { delay: i * 0.09, duration: 0.4, ease: EASE_OUT }
            }
            className="flex items-baseline gap-3.5"
          >
            <span
              aria-hidden
              className={clsx(
                "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                i === 0 ? "bg-qualify" : "bg-white/20",
              )}
            />
            <span className="min-w-0 flex-1 text-[0.9375rem] text-text-dim">{stage.label}</span>
            <span className="t-sys shrink-0 text-text-faint">{stage.detail}</span>
          </motion.li>
        ))}
      </ol>

      <p className="mt-6 border-t border-white/[0.05] pt-4 text-[0.8125rem] leading-relaxed text-text-faint">
        A run reports back once, when it&apos;s finished — so there&apos;s no step-by-step progress
        to show here. ARIE only spends on the companies that survive the screen.
      </p>
    </section>
  );
}
