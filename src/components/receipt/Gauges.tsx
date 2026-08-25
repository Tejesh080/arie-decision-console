"use client";

import { motion, useReducedMotion } from "motion/react";
import { Check, Minus } from "lucide-react";
import clsx from "clsx";
import { formatPercent, formatScore } from "@/lib/format";
import { Eyebrow } from "@/components/ui/Panel";
import { SPRING_TRAVEL } from "@/lib/motion";

/**
 * ARIE stops for two independent reasons, so it gets two independent
 * instruments. Neither is a generic progress bar:
 *
 *   ConfidenceRail — is the calibrated confidence above the autonomy
 *     threshold tau? This is the *autonomy* question: may ARIE act alone?
 *   ScoreBand      — where does the score sit, and how much of the score's
 *     still-reachable range lies on each side of the decision thresholds?
 *     This is the *settled* question: could more evidence still change the
 *     answer?
 *
 * Both draw their gates as labelled ticks with the number attached, because
 * a marker without the threshold beside it tells the reader nothing about
 * whether it cleared.
 */

const RAIL = "relative h-2 rounded-full bg-bg-sunken ring-1 ring-inset ring-border";

function pct(n: number) {
  return `${Math.min(100, Math.max(0, n))}%`;
}

/* ----------------------------------------------------------- confidence -- */

export function ConfidenceRail({
  confidence,
  tau,
  shadow = false,
}: {
  confidence: number;
  tau: number;
  shadow?: boolean;
}) {
  const reduced = useReducedMotion();
  const cleared = confidence >= tau;
  const gapPoints = Math.abs(confidence - tau) * 100;

  const fillColor = shadow ? "bg-shadow-role" : cleared ? "bg-qualify" : "bg-human";

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <Eyebrow>Confidence against the autonomy threshold</Eyebrow>
        <span className="t-data text-[0.6875rem] text-text-faint">
          threshold {formatPercent(tau)}
        </span>
      </div>

      <div className="mt-3">
        <div className={RAIL}>
          {/* Accumulated confidence. */}
          <motion.div
            className={clsx("absolute inset-y-0 left-0 rounded-full", fillColor)}
            initial={reduced ? false : { width: 0 }}
            animate={{ width: pct(confidence * 100) }}
            transition={reduced ? { duration: 0 } : SPRING_TRAVEL}
          />

          {/* The gate. Drawn over the fill so it stays visible when cleared. */}
          <div
            className="absolute -top-1.5 -bottom-1.5 w-px bg-text-dim"
            style={{ left: pct(tau * 100) }}
            aria-hidden
          />

          {/* The marker, which travels to its reading. */}
          <motion.div
            className={clsx(
              "absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg",
              fillColor,
            )}
            initial={reduced ? false : { left: "0%" }}
            animate={{ left: pct(confidence * 100) }}
            transition={reduced ? { duration: 0 } : SPRING_TRAVEL}
          />
        </div>

        <div className="mt-2 flex justify-between">
          <span className="t-data text-[0.6875rem] text-text-faint">0%</span>
          <span className="t-data text-[0.6875rem] text-text-faint">100%</span>
        </div>
      </div>

      <p
        className={clsx(
          "mt-3 flex items-start gap-2 text-[0.8125rem] leading-snug",
          shadow ? "text-shadow-role" : cleared ? "text-qualify" : "text-human",
        )}
      >
        <span className="mt-px shrink-0">
          {cleared ? (
            <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.75} />
          ) : (
            <Minus aria-hidden className="h-3.5 w-3.5" strokeWidth={2.75} />
          )}
        </span>
        <span>
          {shadow
            ? cleared
              ? `Cleared the threshold by ${gapPoints.toFixed(1)} points — enough to have acted alone, had this been an authoritative run.`
              : `Short of the threshold by ${gapPoints.toFixed(1)} points — a human would have been asked, had this been an authoritative run.`
            : cleared
              ? `Cleared the threshold by ${gapPoints.toFixed(1)} points — ARIE was permitted to act without a human.`
              : `Short of the threshold by ${gapPoints.toFixed(1)} points — the decision required a human.`}
        </span>
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- score -- */

export function ScoreBand({
  value,
  lower,
  upper,
  thresholdReject,
  thresholdQualify,
}: {
  value: number;
  lower: number;
  upper: number;
  thresholdReject: number;
  thresholdQualify: number;
}) {
  const reduced = useReducedMotion();

  // A fixed 0–100 domain, widened only if the data genuinely exceeds it.
  // A domain that rescales to the data would make two receipts impossible
  // to compare by eye, which is most of the point of showing a band.
  const domainMin = Math.min(0, lower);
  const domainMax = Math.max(100, upper);
  const span = domainMax - domainMin || 1;
  const at = (n: number) => ((n - domainMin) / span) * 100;

  // Mirrors `arie.scoring.engine.ScoreBounds.settled_decision` exactly, on
  // the same four branches and in the same order. A "settled" interval is one
  // where no still-unknown field could move the outcome; `null` means it
  // genuinely straddles a boundary. Reproduced rather than paraphrased so the
  // caption can never drift from the rule it describes.
  const settled: "qualify" | "reject" | "escalate" | null =
    lower >= thresholdQualify
      ? "qualify"
      : upper < thresholdReject
        ? "reject"
        : lower >= thresholdReject && upper < thresholdQualify
          ? "escalate"
          : null;

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <Eyebrow>Score</Eyebrow>
          <p className="t-metric mt-2 text-[2rem] text-text">{formatScore(value)}</p>
        </div>
        <div className="text-right">
          <Eyebrow>Reachable range</Eyebrow>
          <p className="t-metric mt-2 text-[2rem] text-text-dim">
            {formatScore(lower)}–{formatScore(upper)}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <div className={RAIL}>
          {/* Reject zone / qualify zone washes, so the rail reads as three
              named regions rather than an undifferentiated bar. */}
          <div
            className="absolute inset-y-0 left-0 rounded-l-full bg-reject-wash"
            style={{ width: pct(at(thresholdReject)) }}
            aria-hidden
          />
          <div
            className="absolute inset-y-0 right-0 rounded-r-full bg-qualify-wash"
            style={{ left: pct(at(thresholdQualify)) }}
            aria-hidden
          />

          {/* The still-reachable band. */}
          <motion.div
            className="absolute inset-y-0 rounded-full bg-machine/45"
            style={{ left: pct(at(lower)) }}
            initial={reduced ? false : { width: 0 }}
            animate={{ width: pct(Math.max(0, at(upper) - at(lower))) }}
            transition={reduced ? { duration: 0 } : SPRING_TRAVEL}
            aria-hidden
          />

          {/* Threshold gates. */}
          <div
            className="absolute -top-1.5 -bottom-1.5 w-px bg-reject"
            style={{ left: pct(at(thresholdReject)) }}
            aria-hidden
          />
          <div
            className="absolute -top-1.5 -bottom-1.5 w-px bg-qualify"
            style={{ left: pct(at(thresholdQualify)) }}
            aria-hidden
          />

          <motion.div
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg bg-machine"
            initial={reduced ? false : { left: pct(at(lower)) }}
            animate={{ left: pct(at(value)) }}
            transition={reduced ? { duration: 0 } : SPRING_TRAVEL}
          />
        </div>

        <div className="mt-2 flex justify-between">
          <span className="t-data text-[0.6875rem] text-reject">
            reject &lt; {formatScore(thresholdReject)}
          </span>
          <span className="t-data text-[0.6875rem] text-qualify">
            qualify ≥ {formatScore(thresholdQualify)}
          </span>
        </div>
      </div>

      <p className="mt-3 text-[0.8125rem] leading-snug text-text-dim">
        {settled === "qualify"
          ? "Settled: the whole reachable range sits at or above the qualify threshold, so no outstanding field could have changed the outcome."
          : settled === "reject"
            ? "Settled: the whole reachable range sits below the reject threshold, so no outstanding field could have qualified this lead."
            : settled === "escalate"
              ? "Settled: the whole reachable range sits inside the borderline band between the two thresholds — provably a lead for a person to look at."
              : "Not settled: the reachable range still straddles a threshold, so a field ARIE never resolved could in principle have moved the outcome."}
      </p>
    </div>
  );
}
