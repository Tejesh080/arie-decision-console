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
import { Badge } from "@/components/ui/Badge";
import { Panel, Eyebrow } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { FeedbackButtons } from "@/components/lead/FeedbackButtons";

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

  return (
    <Panel accent={PRIORITY_ACCENT[recommendation.priority]} padding="lg">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Eyebrow>ARIE recommends</Eyebrow>
          <div className="mt-1.5">
            <Badge tone={priorityTone(recommendation.priority)}>
              {priorityLabel(recommendation.priority)}
            </Badge>
          </div>
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
        </>
      )}

      {isPending && <p className="mt-4 text-sm text-text-dim">{recommendation.short_reason}</p>}

      <div className="mt-6 border-t border-border pt-4">
        <FeedbackButtons leadId={leadId} />
      </div>
    </Panel>
  );
}
