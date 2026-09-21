"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { getExplanation } from "@/lib/api/leads";
import type { LeadExplanationResponse, LeadRecommendationResponse } from "@/lib/api/types";
import {
  confidenceBandLabel,
  nextActionLabel,
  priorityLabel,
  priorityTone,
  researchStatusLabel,
} from "@/lib/format/recommendation";
import { decisionLabel, evidenceSufficiencyLabel } from "@/lib/format/decision";
import { Badge } from "@/components/ui/Badge";
import { Panel, Eyebrow } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { AskArieAboutLead } from "@/components/lead/AskArieAboutLead";
import { FeedbackButtons } from "@/components/lead/FeedbackButtons";
import { ResearchOption } from "@/components/lead/ResearchOption";

const PRIORITY_ACCENT = {
  contact_first: "qualify",
  worth_pursuing: "machine",
  review: "human",
  skip: "reject",
} as const;

/**
 * "I uploaded leads and now I immediately know who matters and what to do" —
 * M7 Slice 4's whole point. This is the first thing a customer reads on a
 * lead's page; the Decision Receipt (`DecisionReceiptView`) stays available
 * underneath as Advanced Details for anyone who wants the machine's own
 * accounting of how it got here.
 */
export function RecommendationPanel({
  leadId,
  recommendation,
}: {
  leadId: string;
  recommendation: LeadRecommendationResponse;
}) {
  const [explanation, setExplanation] = useState<LeadExplanationResponse | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [explanationError, setExplanationError] = useState(false);

  async function requestExplanation() {
    setLoadingExplanation(true);
    setExplanationError(false);
    try {
      const result = await getExplanation(leadId);
      setExplanation(result);
    } catch {
      setExplanationError(true);
    } finally {
      setLoadingExplanation(false);
    }
  }

  const isPending = recommendation.score === null;
  const factualClaims = explanation?.claims.filter((c) => !c.hypothesis) ?? [];
  const hypotheses = explanation?.claims.filter((c) => c.hypothesis) ?? [];
  // Priority 3 (2026-09-21): "review" already covers an open human review and
  // a not-yet-decided lead, both correctly labelled "Review" — but a lead
  // that landed here specifically because unresolved evidence still crosses
  // a decision boundary (not because a human needs to weigh in on something
  // ARIE is otherwise sure of) deserves its own, more specific word. Backend
  // recommendation/priority is unchanged; this only picks a more precise
  // label for the identical "review" value.
  const needsMoreEvidence =
    recommendation.priority === "review" &&
    recommendation.evidence_sufficiency === "insufficient_evidence";
  const priorityDisplayLabel = needsMoreEvidence
    ? "Needs more evidence"
    : priorityLabel(recommendation.priority);

  return (
    <Panel accent={PRIORITY_ACCENT[recommendation.priority]} padding="lg">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Eyebrow>ARIE recommends</Eyebrow>
          <div className="mt-1.5">
            <Badge tone={priorityTone(recommendation.priority)}>{priorityDisplayLabel}</Badge>
          </div>
          {/* This customer-facing priority is a derived read, never the raw
              machine call — the two must stay visibly separate rather than
              collapsing into one badge (see VerdictPanel's identical pairing
              in the Decision Receipt below). A "Needs more evidence" priority
              sitting on top of a raw "Reject" is the whole point of the
              evidence_sufficiency hardening: the badge above is what to do
              next, this line is what ARIE actually concluded and how sure it
              was of the evidence behind that. */}
          {recommendation.machine_decision && (
            <p className="mt-2 text-[0.75rem] leading-relaxed text-text-faint">
              Machine recommendation{" "}
              <span className="font-medium text-text-dim">
                {decisionLabel(recommendation.machine_decision)}
              </span>
              {recommendation.evidence_sufficiency && (
                <>
                  {" "}
                  · Evidence{" "}
                  <span className="font-medium text-text-dim">
                    {evidenceSufficiencyLabel(recommendation.evidence_sufficiency)}
                  </span>
                </>
              )}
            </p>
          )}
        </div>
        {recommendation.confidence_band && (
          <div className="text-right">
            <Eyebrow>Confidence</Eyebrow>
            <p className="t-h3 mt-1 text-text">
              {confidenceBandLabel(recommendation.confidence_band)}
            </p>
          </div>
        )}
      </div>

      {!isPending && (
        <>
          <div className="mt-5">
            <Eyebrow>Why</Eyebrow>
            <p className="mt-1.5 text-sm leading-relaxed text-text-dim">
              {explanation ? explanation.summary : recommendation.short_reason}
            </p>
            {explanation &&
              explanation.source === "deterministic" &&
              explanation.unavailable_reason && (
                <p className="mt-1 text-xs text-text-faint">{explanation.unavailable_reason}</p>
              )}
          </div>

          {factualClaims.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1 text-sm text-text-dim">
              {factualClaims.map((claim, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden className="text-text-faint">
                    •
                  </span>
                  {claim.text}
                </li>
              ))}
            </ul>
          )}

          {hypotheses.length > 0 && (
            <div className="mt-3 flex flex-col gap-1">
              {hypotheses.map((claim, i) => (
                <p key={i} className="text-xs text-text-faint italic">
                  Hypothesis: {claim.text}
                </p>
              ))}
            </div>
          )}

          {!explanation && (
            <div className="mt-3">
              <Button
                variant="ghost"
                size="sm"
                disabled={loadingExplanation}
                onClick={requestExplanation}
                className="px-0"
              >
                {loadingExplanation ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.25} />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} />
                )}
                Generate detailed explanation
              </Button>
              {explanationError && (
                <p className="mt-1 text-xs text-reject">
                  Detailed AI explanation is temporarily unavailable.
                </p>
              )}
            </div>
          )}

          <div className="mt-5 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
            <div>
              <Eyebrow>Next</Eyebrow>
              <p className="mt-1 text-sm text-text">
                {nextActionLabel(recommendation.next_action)}
              </p>
            </div>
            <div>
              <Eyebrow>Research</Eyebrow>
              <p className="mt-1 text-sm text-text">
                {researchStatusLabel(recommendation.research_status)}
                {recommendation.execution_mode === "simulated" && (
                  <span className="ml-1.5 text-xs text-text-faint">(simulated)</span>
                )}
              </p>
            </div>
          </div>

          {(recommendation.key_evidence.length > 0 ||
            recommendation.missing_information.length > 0) && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {recommendation.key_evidence.length > 0 && (
                <div>
                  <Eyebrow>Key evidence</Eyebrow>
                  <ul className="mt-1.5 flex flex-col gap-1 text-sm text-text-dim">
                    {recommendation.key_evidence.map((item) => (
                      <li key={item} className="capitalize">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {recommendation.missing_information.length > 0 && (
                <div>
                  <Eyebrow>Missing</Eyebrow>
                  <ul className="mt-1.5 flex flex-col gap-1 text-sm text-text-faint">
                    {recommendation.missing_information.map((item) => (
                      <li key={item} className="capitalize">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {recommendation.missing_information.length > 0 && <ResearchOption leadId={leadId} />}
        </>
      )}

      {isPending && <p className="mt-4 text-sm text-text-dim">{recommendation.short_reason}</p>}

      {!isPending && <AskArieAboutLead leadId={leadId} />}

      <div className="mt-6 border-t border-border pt-4">
        <FeedbackButtons leadId={leadId} />
      </div>
    </Panel>
  );
}
