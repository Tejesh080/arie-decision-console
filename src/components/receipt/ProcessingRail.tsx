"use client";

import { motion, useReducedMotion } from "motion/react";
import { Check, RefreshCw } from "lucide-react";
import clsx from "clsx";
import type { LeadStatus } from "@/lib/api/types";
import { PROCESSING_SEQUENCE, statusLabel } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Eyebrow, Panel } from "@/components/ui/Panel";
import { SPRING_LAYOUT } from "@/lib/motion";

/**
 * Live progress through the state machine.
 *
 * Every stage here is a real `LeadStatus` the worker actually transitions
 * through — nothing is a synthetic "Analyzing…" step invented to fill the
 * wait, and there is no fake percentage. The rail advances only when the
 * backend says the lead moved, so a stalled lead visibly stalls instead of
 * creeping toward 99%.
 *
 * A status outside the sequence means the lead has branched (decided,
 * escalated, failed); that is treated as "all stages behind us", not as an
 * unknown.
 */
export function ProcessingRail({
  liveStatus,
  timedOut,
  onRefresh,
  compact = false,
}: {
  liveStatus: LeadStatus | null;
  timedOut?: boolean;
  onRefresh?: () => void;
  compact?: boolean;
}) {
  const reduced = useReducedMotion();
  const currentIndex = liveStatus ? PROCESSING_SEQUENCE.indexOf(liveStatus) : -1;
  const branched = liveStatus !== null && currentIndex === -1;

  const body = (
    <>
      <div className="flex items-center justify-between gap-4">
        <Eyebrow>{branched ? "Resolved" : "Processing"}</Eyebrow>
        {!branched && (
          <span className="flex items-center gap-1.5">
            <span className="breathe h-1.5 w-1.5 rounded-full bg-machine" />
            <span className="t-data text-[0.6875rem] text-text-faint">live</span>
          </span>
        )}
      </div>

      <ol className="mt-4 flex flex-col gap-0">
        {PROCESSING_SEQUENCE.map((stage, index) => {
          const done = branched || currentIndex > index;
          const active = !branched && currentIndex === index;
          const last = index === PROCESSING_SEQUENCE.length - 1;

          return (
            <li key={stage} className="flex gap-3">
              <div className="flex flex-col items-center">
                <motion.span
                  className={clsx(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[0.625rem]",
                    done
                      ? "border-machine bg-machine text-[#06080d]"
                      : active
                        ? "border-machine text-machine"
                        : "border-border-strong text-text-faint",
                  )}
                  animate={reduced ? undefined : { scale: active ? 1.08 : 1 }}
                  transition={SPRING_LAYOUT}
                >
                  {done ? <Check aria-hidden className="h-3 w-3" strokeWidth={3} /> : index + 1}
                </motion.span>
                {!last && (
                  <span
                    className={clsx(
                      "w-px flex-1 transition-colors duration-300",
                      done ? "bg-machine/50" : "bg-border",
                    )}
                  />
                )}
              </div>
              <span
                className={clsx(
                  "pb-3.5 text-sm transition-colors duration-200",
                  done || active ? "text-text" : "text-text-faint",
                )}
              >
                {statusLabel(stage)}
                {active && (
                  <span className="breathe ml-2 inline-block h-1 w-1 translate-y-[-2px] rounded-full bg-machine align-middle" />
                )}
              </span>
            </li>
          );
        })}
      </ol>

      {branched && liveStatus && (
        <p className="rounded-md border border-border bg-bg-sunken px-3 py-2 text-sm text-text">
          {statusLabel(liveStatus)}
        </p>
      )}

      {timedOut && (
        <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <p className="min-w-0 flex-1 text-sm text-text-dim">
            Still not settled after 20 seconds of watching. ARIE may yet finish — nothing here is
            lost.
          </p>
          {onRefresh && (
            <Button variant="secondary" size="sm" onClick={onRefresh}>
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.25} />
              Check again
            </Button>
          )}
        </div>
      )}
    </>
  );

  if (compact) return <div>{body}</div>;
  return <Panel accent="machine">{body}</Panel>;
}
