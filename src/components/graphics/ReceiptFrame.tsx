"use client";

import { motion, useReducedMotion } from "motion/react";
import { CircleCheck, Timer } from "lucide-react";
import { EASE_OUT } from "@/lib/motion";

/**
 * The hero's concrete object: a stylised rendering of the actual surface a
 * Decision Receipt produces — score, the confidence-vs-threshold read, and
 * the stop reason — in the same visual language `VerdictPanel` uses. Same
 * construction as `ProductFrame` (browser chrome, floating fact badges,
 * `liquid-surface`/`spectral-edge`), pointed at the receipt instead of a
 * discovery result list, because the homepage's primary story is the
 * stopping policy, not market discovery.
 */
export function ReceiptFrame() {
  const reduced = useReducedMotion();
  const arrive = (delay: number) =>
    reduced ? { duration: 0 } : { delay, duration: 0.55, ease: EASE_OUT };

  return (
    <div className="relative mx-auto w-full max-w-[880px]">
      <motion.div
        initial={{ opacity: 1, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={arrive(0.5)}
        style={{ animation: reduced ? undefined : "arie-float 7.5s ease-in-out infinite" }}
        className="liquid-surface liquid-edge absolute -top-5 right-6 z-20 hidden items-center gap-2 rounded-full py-2 pr-4 pl-2.5 shadow-[var(--e-2)] sm:flex"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-qualify-dim text-qualify ring-1 ring-qualify-edge/60 ring-inset">
          <CircleCheck aria-hidden className="h-3.5 w-3.5" strokeWidth={2.25} />
        </span>
        <span className="t-sys whitespace-nowrap text-text-dim">$0.07 spent, not $0.44</span>
      </motion.div>

      <motion.div
        initial={{ opacity: 1, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={arrive(0.65)}
        style={{ animation: reduced ? undefined : "arie-float 8.5s ease-in-out infinite 0.4s" }}
        className="liquid-surface liquid-edge absolute -bottom-5 left-6 z-20 hidden items-center gap-2 rounded-full py-2 pr-4 pl-2.5 shadow-[var(--e-2)] sm:flex"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-machine-dim text-machine ring-1 ring-machine-edge/60 ring-inset">
          <Timer aria-hidden className="h-3.5 w-3.5" strokeWidth={2.25} />
        </span>
        <span className="t-sys whitespace-nowrap text-text-dim">Stopped after 4 of 8 checks</span>
      </motion.div>

      {/* The frame itself. */}
      <motion.div
        initial={{ opacity: 1, y: 26, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={arrive(0.2)}
        className="liquid-surface liquid-edge spectral-edge grain-veil relative overflow-hidden rounded-[1.75rem]"
      >
        {/* Browser chrome */}
        <div className="flex items-center gap-3 border-b border-white/[0.06] bg-black/25 px-5 py-3.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          </div>
          <div className="mx-auto flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3.5 py-1.5 text-[0.75rem] text-text-faint">
            <span className="h-1.5 w-1.5 rounded-full bg-qualify" />
            arie.app/demo
          </div>
        </div>

        {/* Product content */}
        <div className="p-5 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.9375rem] font-semibold text-text">Nadia Delacroix</p>
              <p className="t-sys truncate text-text-faint">nadia.delacroix@lumen500.com</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-qualify-dim px-3 py-1 text-[0.75rem] font-medium text-qualify ring-1 ring-qualify-edge/50 ring-inset">
              <CircleCheck aria-hidden className="h-3.5 w-3.5" strokeWidth={2.25} />
              Auto-routed
            </span>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 sm:gap-4">
            <FactCell label="Score" value="78.4" caption="65.0+ qualifies" />
            <FactCell label="Confidence" value="87%" tone="var(--qualify)" caption="vs. 79% threshold" />
            <FactCell label="Modelled cost" value="$0.07" caption="of a $1.50 cap" />
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-[0.75rem] text-text-faint">
              <span>Confidence against the autonomy threshold</span>
              <span className="t-data">79%</span>
            </div>
            <div className="relative mt-2 h-1.5 rounded-full bg-white/[0.06]">
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: "87%", background: "linear-gradient(90deg, #2fb89b, var(--qualify))" }}
              />
              <span
                aria-hidden
                className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-white/50"
                style={{ left: "79%" }}
              />
            </div>
          </div>

          <div className="mt-5 rounded-xl bg-white/[0.03] p-3.5 ring-1 ring-white/[0.05] ring-inset">
            <p className="t-sys text-text-faint">Why ARIE stopped</p>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-text-dim">
              Confidence cleared the threshold with two of the catalogue&apos;s eight checks still
              unbought — nothing left to buy could still change the answer.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function FactCell({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: string;
  caption: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/[0.05] ring-inset sm:p-3.5">
      <p className="t-sys truncate text-text-faint">{label}</p>
      <p className="t-data mt-1 text-[1.375rem] font-semibold sm:text-[1.5rem]" style={tone ? { color: tone } : undefined}>
        {value}
      </p>
      <p className="mt-0.5 truncate text-[0.6875rem] text-text-faint">{caption}</p>
    </div>
  );
}
