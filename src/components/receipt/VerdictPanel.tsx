"use client";

import { Eye } from "lucide-react";
import clsx from "clsx";
import type { ReceiptResponse } from "@/lib/api/types";
import { decisionLabel, decisionPastTense } from "@/lib/format/decision";
import { formatPercent, formatScore, formatUsdCompact, statusLabel } from "@/lib/format";
import { costNounShort, costCaveat, isSimulated } from "@/lib/api/providerMode";
import { Badge } from "@/components/ui/Badge";
import { Eyebrow, Panel } from "@/components/ui/Panel";
import { ConfidenceRail } from "./Gauges";

/**
 * The answer, in a fixed reading order.
 *
 *   WHAT HAPPENED  -> the outcome and the four numbers behind it
 *   WHY IT STOPPED -> in a sentence, not a reason code
 *   WHAT IT USED   -> cached vs bought, and what that cost
 *
 * The order is the point. Previously this panel led with numbers and left the
 * reader to work out why any of them mattered; a visitor who does not already
 * know what an autonomy threshold is got no help at all. Now every figure sits
 * next to a plain-language statement of what it means for this lead.
 */
export function VerdictPanel({ receipt }: { receipt: ReceiptResponse }) {
  const { decision, score, stopping, shadow } = receipt;
  if (!decision || !score || !stopping) return null;

  const escalated = !decision.autonomous && !shadow;
  const reviewResolved = escalated && !!receipt.human_review?.responded_at;
  const cleared = score.confidence >= score.tau;
  const gap = Math.abs(score.confidence - score.tau) * 100;

  const accent = shadow ? "shadow" : escalated ? "human" : "machine";
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

  const fresh = receipt.providers.called.filter((c) => !c.cache_hit).length;
  const cached = receipt.providers.called.length - fresh;

  return (
    <Panel accent={accent} padding="lg" as="section">
      {/* ---------------------------------------------- what happened -- */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <span className="flex items-center gap-2">
            {shadow && (
              <Eye aria-hidden className="h-3.5 w-3.5 text-shadow-role" strokeWidth={2.25} />
            )}
            <Eyebrow>What happened</Eyebrow>
          </span>
          <h2 className={clsx("t-h1 mt-2.5", headlineTone)}>{headline}</h2>
          <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-text-dim">
            {shadow ? (
              <>
                ARIE worked the lead all the way through and then deliberately did nothing with the
                answer — nothing routed, nothing rejected, nobody asked. This is what it{" "}
                <em>would</em> have done.
              </>
            ) : reviewResolved ? (
              <>
                ARIE recommended{" "}
                <strong className="font-medium text-text">
                  {decisionLabel(decision.recommended_action)}
                </strong>{" "}
                but was not confident enough to act alone, so{" "}
                <strong className="font-medium text-text">
                  {receipt.human_review?.reviewer ?? "a reviewer"}
                </strong>{" "}
                decided.{" "}
                {decision.human_override
                  ? "They went a different way from ARIE. Both records stand, in sequence, below."
                  : "They agreed with ARIE."}
              </>
            ) : escalated ? (
              <>
                ARIE recommended{" "}
                <strong className="font-medium text-text">
                  {decisionLabel(decision.recommended_action)}
                </strong>
                , but was not confident enough to act on that alone — so it stopped and handed the
                call to a person rather than guessing.
              </>
            ) : (
              <>
                ARIE was confident enough to act without anyone checking, so it did. Final status:{" "}
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

      {/* Four numbers, each with what it means written underneath it. */}
      <dl className="mt-8 grid grid-cols-2 gap-x-5 gap-y-6 border-t border-border pt-6 sm:grid-cols-4">
        <Figure
          label="Score"
          value={formatScore(score.value)}
          meaning={`${formatScore(score.threshold_qualify)} or above qualifies`}
        />
        <Figure
          label="Confidence"
          value={formatPercent(score.confidence)}
          tone={shadow ? "text-shadow-role" : cleared ? "text-qualify" : "text-human"}
          meaning="how sure ARIE was in this answer"
        />
        <Figure
          label="Autonomy threshold"
          value={formatPercent(score.tau)}
          meaning={
            cleared
              ? `cleared it by ${gap.toFixed(1)} points`
              : `missed it by ${gap.toFixed(1)} points`
          }
        />
        <Figure
          label={costNounShort()}
          value={formatUsdCompact(receipt.cost.total_cost_usd)}
          meaning={`of a ${formatUsdCompact(receipt.cost.budget_usd_cap)} budget for this lead`}
        />
      </dl>

      <div className="mt-7">
        <ConfidenceRail confidence={score.confidence} tau={score.tau} shadow={shadow} />
      </div>

      {/* ------------------------------------------------ why it stopped -- */}
      <div className="mt-8 border-t border-border pt-6">
        <Eyebrow>Why ARIE stopped</Eyebrow>
        <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-text">{stopping.explanation}</p>
        <p className="mt-2 text-[0.8125rem] leading-relaxed text-text-faint">
          Every provider call costs money, so ARIE only keeps buying while the next one could still
          change the answer.{" "}
          <code className="t-data rounded border border-border bg-bg-sunken px-1.5 py-0.5">
            {stopping.reason_code}
          </code>{" "}
          is the rule that fired.
        </p>
      </div>

      {/* -------------------------------------------------- what it used -- */}
      <div className="mt-7 border-t border-border pt-6">
        <Eyebrow>What it used</Eyebrow>
        <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-text">
          {cached > 0 && (
            <>
              <strong className="font-medium">{cached}</strong> signal{cached === 1 ? "" : "s"}{" "}
              already cached from earlier leads
              {fresh > 0 ? ", " : " — nothing new had to be bought"}
            </>
          )}
          {fresh > 0 && (
            <>
              {cached > 0 ? "and " : ""}
              <strong className="font-medium">{fresh}</strong> new provider call
              {fresh === 1 ? "" : "s"}
            </>
          )}
          {(cached > 0 || fresh > 0) && (
            <>
              , for{" "}
              <strong className="font-medium">
                {formatUsdCompact(receipt.cost.total_cost_usd)}
              </strong>
              {isSimulated() ? " of modelled cost" : ""}.
            </>
          )}
          {cached === 0 && fresh === 0 && "No provider was reached before ARIE stopped."}
        </p>
        <p className="mt-2 text-[0.8125rem] leading-relaxed text-text-faint">{costCaveat()}</p>
      </div>
    </Panel>
  );
}

/** A figure with its meaning attached. A number nobody can interpret is
 * decoration; the caption is the part that does the work. */
function Figure({
  label,
  value,
  meaning,
  tone,
}: {
  label: string;
  value: string;
  meaning: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0">
      <dt>
        <Eyebrow>{label}</Eyebrow>
      </dt>
      <dd>
        <p className={clsx("t-metric mt-2 text-[1.75rem]", tone ?? "text-text")}>{value}</p>
        <p className="mt-1.5 text-[0.75rem] leading-snug text-text-faint">{meaning}</p>
      </dd>
    </div>
  );
}
