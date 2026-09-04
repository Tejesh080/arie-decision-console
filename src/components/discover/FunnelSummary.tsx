"use client";

import { motion, useReducedMotion } from "motion/react";
import clsx from "clsx";
import type { DiscoveryFunnel } from "@/lib/api/types";
import { EASE_OUT } from "@/lib/motion";

/**
 * "How did N possibilities become these opportunities?" — drawn as the
 * narrowing it actually is, rather than eight equal stat tiles that hide
 * the shape of the work.
 *
 * Each bar's width is the stage's real share of the widest stage, so the
 * collapse from "everything the market returned" to "people you can
 * actually contact" is visible at a glance. Every figure is read straight
 * off `arie.discovery.models.DiscoveryFunnel`; the only arithmetic here is
 * `promising + possible`, which is the screen's own pass mark, and the
 * proportion each bar is drawn at.
 */
export function FunnelSummary({ funnel }: { funnel: DiscoveryFunnel }) {
  const reduced = useReducedMotion();

  const steps = [
    { label: "Companies found", value: funnel.unique_companies, hint: `${funnel.search_queries} searches` },
    { label: "Looked promising", value: funnel.promising + funnel.possible, hint: "after the cheap screen" },
    { label: "Verified on their site", value: funnel.website_verified, hint: "checked against their own words" },
    { label: "Became opportunities", value: funnel.final_opportunities, hint: "worth your attention" },
    {
      label: "You can contact",
      value: funnel.final_contactable_opportunities,
      hint: "a named person with a usable channel",
      accent: true,
    },
  ];

  const max = Math.max(...steps.map((s) => s.value), 1);

  return (
    <section className="island overflow-hidden p-7 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 className="text-[1.0625rem] font-semibold tracking-[-0.02em] text-text">
          What the run went through
        </h2>
        <p className="text-[0.8125rem] text-text-faint">
          {funnel.raw_candidates} raw results · {funnel.provider_calls + funnel.website_calls} paid
          lookups
        </p>
      </div>

      <ol className="mt-7 flex flex-col gap-4">
        {steps.map((step, i) => {
          const share = Math.max(step.value / max, step.value > 0 ? 0.035 : 0);
          return (
            <li key={step.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2.5">
                  <span
                    className={clsx(
                      "text-[0.9375rem] font-medium",
                      step.accent ? "text-qualify" : "text-text",
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="text-[0.75rem] text-text-faint">{step.hint}</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
                  <motion.div
                    className={clsx(
                      "h-full origin-left rounded-full",
                      step.accent
                        ? "bg-[linear-gradient(90deg,var(--qualify),#8ff0dc)]"
                        : "bg-white/25",
                    )}
                    initial={reduced ? false : { scaleX: 0 }}
                    animate={{ scaleX: share }}
                    style={{ width: "100%" }}
                    transition={
                      reduced
                        ? { duration: 0 }
                        : { delay: 0.08 * i, duration: 0.7, ease: EASE_OUT }
                    }
                  />
                </div>
              </div>
              <span
                className={clsx(
                  "t-metric text-[1.375rem] tabular-nums",
                  step.accent ? "text-qualify" : "text-text",
                )}
              >
                {step.value}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-6 border-t border-white/[0.05] pt-4 text-[0.8125rem] leading-relaxed text-text-faint">
        &ldquo;You can contact&rdquo; means ARIE found a named person with an email it could stand
        behind. The rest are still real opportunities — they just need a channel first.
      </p>
    </section>
  );
}
