"use client";

import { CircleStop, Eye } from "lucide-react";
import clsx from "clsx";
import type { ReceiptResponse } from "@/lib/api/types";
import { decisionLabel, decisionPastTense } from "@/lib/format/decision";
import { formatPercent, formatScore, formatUsdCompact, statusLabel } from "@/lib/format";
import { costNounShort, costCaveat } from "@/lib/api/providerMode";
import { Badge } from "@/components/ui/Badge";
import { Eyebrow, Panel } from "@/components/ui/Panel";
import { Stat, StatRow } from "@/components/ui/Stat";
import { ConfidenceRail } from "./Gauges";

/**
 * The answer, above the fold.
 *
 * A reader should be able to leave after this one panel knowing what ARIE
 * decided, how sure it was, whether it was allowed to act alone, why it
 * stopped gathering evidence, and what that cost. Everything below it on the
 * page is the supporting detail for a claim already made here.
 *
 * The three modes are visually distinct on purpose — an autonomous decision,
 * a decision handed to a person, and a shadow evaluation that changed
 * nothing are three different kinds of event, not three colours of the same
 * event.
 */
export function VerdictPanel({ receipt }: { receipt: ReceiptResponse }) {
  const { decision, score, stopping, shadow } = receipt;
  if (!decision || !score || !stopping) return null;

  // An escalation has two distinct phases and they must not read alike.
  // While the review is open, the headline is "escalated" -- that *is* the
  // current state. Once a reviewer has responded, "escalated" describes a
  // step that already happened, and leaving it as the headline would bury
  // the actual outcome behind a stale one.
  const escalated = !decision.autonomous && !shadow;
  const reviewResolved = escalated && !!receipt.human_review?.responded_at;

  const accent = shadow ? "shadow" : escalated ? "human" : "machine";

  // When a lead escalated, the machine/human/final chain below states the
  // recommendation as its own stage. Repeating it as this panel's headline
  // put the word "Reject" on screen twice in two different colours, reading
  // as two separate findings. Here the headline is what *happened* to the
  // lead; the recommendation moves into the prose, where it is still stated
  // outright and never softened.
  const headline = shadow
    ? `Would have ${decisionPastTense(decision.recommended_action)}`
    : reviewResolved
      ? statusLabel(receipt.lead_status)
      : escalated
        ? "Escalated to a human"
        : decisionLabel(decision.recommended_action);
  const headlineTone = shadow
    ? "text-shadow-role"
    : reviewResolved
      ? decision.human_override
        ? "text-human"
        : "text-qualify"
      : escalated
        ? "text-human"
        : "text-machine";

  return (
    <Panel accent={accent} padding="lg" as="section">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <span className="flex items-center gap-2">
            {shadow && (
              <Eye aria-hidden className="h-3.5 w-3.5 text-shadow-role" strokeWidth={2.25} />
            )}
            <Eyebrow>
              {shadow
                ? "Shadow evaluation"
                : reviewResolved
                  ? "Final outcome — after human review"
                  : escalated
                    ? "Decision outcome"
                    : "Autonomous decision"}
            </Eyebrow>
          </span>
          <h2 className={clsx("t-h1 mt-2.5", headlineTone)}>{headline}</h2>
          <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-text-dim">
            {shadow ? (
              <>
                ARIE computed this recommendation alongside the existing workflow and took{" "}
                <strong className="font-medium text-text">no authoritative action</strong> — nothing
                was routed, nothing rejected, no human review opened. This is what ARIE would have
                done, not what happened.
              </>
            ) : reviewResolved ? (
              <>
                ARIE recommended{" "}
                <strong className="font-medium text-text">
                  {decisionLabel(decision.recommended_action)}
                </strong>{" "}
                but could not act alone, so{" "}
                <strong className="font-medium text-text">
                  {receipt.human_review?.reviewer ?? "a reviewer"}
                </strong>{" "}
                decided.{" "}
                {decision.human_override
                  ? "They went a different way from ARIE — both records stand, in sequence, below."
                  : "They upheld ARIE's recommendation."}
              </>
            ) : escalated ? (
              <>
                ARIE recommended{" "}
                <strong className="font-medium text-text">
                  {decisionLabel(decision.recommended_action)}
                </strong>
                , but confidence did not clear the autonomy threshold — so it stopped short of
                acting and handed the call to a person. That recommendation stands on the record
                whatever the reviewer decides.
              </>
            ) : (
              <>
                Confidence cleared the autonomy threshold, so ARIE acted without a human. Final
                status:{" "}
                <strong className="font-medium text-text">
                  {statusLabel(receipt.lead_status)}
                </strong>
                .
              </>
            )}
          </p>
        </div>

        {shadow ? (
          <Badge tone="shadow" variant="outline">
            No routing action executed
          </Badge>
        ) : reviewResolved && decision.human_override ? (
          <Badge tone="human">Human override</Badge>
        ) : null}
      </div>

      <div className="mt-8 border-t border-border pt-6">
        <StatRow>
          <Stat
            label="Score"
            hint={`≥ ${formatScore(score.threshold_qualify)} qualifies`}
            value={formatScore(score.value)}
          />
          <Stat
            label="Confidence"
            hint={`threshold ${formatPercent(score.tau)}`}
            value={formatPercent(score.confidence)}
            tone={shadow ? "shadow" : score.confidence >= score.tau ? "qualify" : "human"}
          />
          <Stat
            label="Autonomous"
            value={decision.autonomous ? "Yes" : "No"}
            // Green "Yes" would read as "it went ahead". Under shadow mode the
            // autonomy check passed but nothing was executed, so it stays in
            // the shadow colour and says so underneath.
            tone={shadow ? "shadow" : decision.autonomous ? "qualify" : "human"}
            sub={shadow ? "Computed, never executed" : undefined}
          />
          <Stat
            label={costNounShort()}
            hint={`cap ${formatUsdCompact(receipt.cost.budget_usd_cap)}`}
            value={formatUsdCompact(receipt.cost.total_cost_usd)}
          />
        </StatRow>
      </div>

      <div className="mt-8">
        <ConfidenceRail confidence={score.confidence} tau={score.tau} shadow={shadow} />
      </div>

      <div className="mt-7 rounded-md border border-border bg-bg-sunken p-4">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-2">
          <CircleStop
            aria-hidden
            className="h-3.5 w-3.5 shrink-0 text-text-faint"
            strokeWidth={2.25}
          />
          <Eyebrow>Why ARIE stopped acquiring evidence</Eyebrow>
          <code className="t-data rounded border border-border bg-surface px-1.5 py-0.5 text-text-dim sm:ml-auto">
            {stopping.reason_code}
          </code>
        </span>
        <p className="mt-2.5 text-sm leading-relaxed text-text-dim">{stopping.explanation}</p>
      </div>

      <p className="mt-4 text-[0.6875rem] leading-relaxed text-text-faint">{costCaveat()}</p>
    </Panel>
  );
}
