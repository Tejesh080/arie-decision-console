"use client";

import { motion, useReducedMotion } from "motion/react";
import clsx from "clsx";
import type { ReceiptResponse } from "@/lib/api/types";
import { formatPercent, formatUsdCompact } from "@/lib/format";
import { decisionLabel, decisionPastTense } from "@/lib/format/decision";
import { EASE_OUT } from "@/lib/motion";

/**
 * The whole product, drawn as one column.
 *
 * Lead comes in, evidence is bought one step at a time with its price
 * attached, confidence lands somewhere relative to the threshold, and the run
 * stops. Every number here is this lead's real data — the acquisition steps
 * are the actual provider calls that cost something, in the order the ledger
 * recorded them.
 *
 * This explains ARIE better than any amount of prose beside it, which is why
 * it sits directly under the verdict rather than at the bottom of the page.
 */
export function StopFlow({ receipt }: { receipt: ReceiptResponse }) {
  const reduced = useReducedMotion();
  const { score, decision, shadow } = receipt;
  if (!score || !decision) return null;

  const cleared = score.confidence >= score.tau;

  // Only fresh calls are steps worth drawing: a cache hit costs nothing and
  // buys nothing new, and showing seven identical $0 rows would bury the ones
  // that actually spent money. The reused count is stated instead.
  const bought = receipt.providers.called.filter((c) => !c.cache_hit);
  const reused = receipt.providers.called.length - bought.length;

  const accent = shadow ? "text-shadow-role" : cleared ? "text-qualify" : "text-human";
  const step = (i: number) =>
    reduced ? { duration: 0 } : { duration: 0.34, delay: 0.12 + i * 0.09, ease: EASE_OUT };

  return (
    <div className="surface-flat p-5 sm:p-6">
      <p className="t-label text-text-faint">How this lead reached its decision</p>

      <ol className="mt-5 flex flex-col items-start">
        <Node index={0} step={step} reduced={reduced} label="Lead received" tone="neutral" />

        {reused > 0 && (
          <Node
            index={1}
            step={step}
            reduced={reduced}
            label={`${reused} signal${reused === 1 ? "" : "s"} already cached`}
            price="$0"
            tone="qualify"
            note="reused, nothing spent"
          />
        )}

        {bought.map((call, i) => (
          <Node
            key={`${call.provider}-${i}`}
            index={2 + i}
            step={step}
            reduced={reduced}
            label={call.provider}
            price={`+${formatUsdCompact(call.cost_usd)}`}
            tone="machine"
            note={call.status === "success" ? undefined : "returned nothing"}
          />
        ))}

        {/* The threshold comparison, which is the actual decision. */}
        <motion.li
          initial={reduced ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={step(2 + bought.length)}
          className="w-full"
        >
          <Rail />
          <div className="w-full rounded-md border border-border bg-bg-sunken px-4 py-3.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-sm text-text-dim">Confidence reached</span>
              <span className={clsx("t-metric text-lg", accent)}>
                {formatPercent(score.confidence)}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-border pt-2">
              <span className="text-sm text-text-faint">Threshold required to act alone</span>
              <span className="t-metric text-lg text-text-dim">{formatPercent(score.tau)}</span>
            </div>
          </div>
        </motion.li>

        <motion.li
          initial={reduced ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={step(3 + bought.length)}
          className="w-full"
        >
          <Rail />
          <p className="t-label text-text-faint">Stop buying evidence</p>
          <Rail />
          <p className={clsx("t-h2", accent)}>
            {shadow
              ? `Would have ${decisionPastTense(decision.recommended_action)}`
              : decisionLabel(decision.recommended_action)}
          </p>
        </motion.li>
      </ol>
    </div>
  );
}

function Node({
  index,
  step,
  reduced,
  label,
  price,
  note,
  tone,
}: {
  index: number;
  step: (i: number) => object;
  reduced: boolean | null;
  label: string;
  price?: string;
  note?: string;
  tone: "neutral" | "machine" | "qualify";
}) {
  const dot =
    tone === "machine" ? "bg-machine" : tone === "qualify" ? "bg-qualify" : "bg-text-faint";
  return (
    <motion.li
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={step(index)}
      className="w-full"
    >
      {index > 0 && <Rail />}
      <div className="flex items-center gap-2.5">
        <span aria-hidden className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
        <span className="t-data min-w-0 truncate text-text">{label}</span>
        {note && <span className="text-[0.6875rem] text-text-faint">{note}</span>}
        {price && (
          <span
            className={clsx(
              "t-data ml-auto shrink-0",
              price === "$0" ? "text-text-faint" : "text-text-dim",
            )}
          >
            {price}
          </span>
        )}
      </div>
    </motion.li>
  );
}

function Rail() {
  return <span aria-hidden className="my-2 ml-[3px] block h-4 w-px bg-border-strong" />;
}
