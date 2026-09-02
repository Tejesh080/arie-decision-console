"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleAlert, MessageSquare } from "lucide-react";
import { analyzeFeedback, getFeedbackInsights } from "@/lib/api/feedbackInsights";
import { ArieApiError } from "@/lib/api/errors";
import type { FeedbackInsights, ICPProfile } from "@/lib/api/types";
import { Panel, Eyebrow, PanelHeader } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { ProposalCard } from "./ProposalCard";

/**
 * M7 Slice 7, Parts A-C/J/K. The customer-facing half of the feedback
 * learning loop — a plain summary of the feedback ARIE has collected so
 * far, and (only on explicit request — Part B2) a check for a targeting
 * improvement. Never says ARIE "retrained itself"; every sentence here is
 * "based on your feedback, ARIE suggests…", matching the backend's own
 * deterministic-fallback wording.
 */
export function FeedbackInsightsPanel({
  canEdit,
  onProfileUpdated,
}: {
  canEdit: boolean;
  onProfileUpdated?: (profile: ICPProfile) => void;
}) {
  const [insights, setInsights] = useState<FeedbackInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getFeedbackInsights()
      .then((result) => {
        if (!cancelled) setInsights(result);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load feedback insights.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const analyse = useCallback(async () => {
    setAnalysing(true);
    setError(null);
    try {
      setInsights(await analyzeFeedback());
    } catch (err) {
      setError(err instanceof ArieApiError ? err.message : String(err));
    } finally {
      setAnalysing(false);
    }
  }, []);

  if (loading) return null;
  if (!insights || insights.total === 0) return null;

  return (
    <Panel className="mt-8">
      <Eyebrow>From your feedback</Eyebrow>
      <PanelHeader
        title={
          <span className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-text-faint" strokeWidth={2} />
            What your feedback says
          </span>
        }
      />
      <p className="mt-2 text-sm text-text-dim">
        {insights.total} recommendation{insights.total === 1 ? "" : "s"} reviewed
        {insights.agreement_rate !== null &&
          ` — ${Math.round(insights.agreement_rate * 100)}% marked useful`}
        .
      </p>

      {insights.support === "insufficient_data" && (
        <p className="mt-3 text-sm text-text-faint">
          Keep marking recommendations useful or not — ARIE needs a bit more feedback before it can
          look for a pattern.
        </p>
      )}

      {insights.support === "summary_only" && (
        <p className="mt-3 text-sm text-text-faint">
          A little more feedback and ARIE can check for a targeting pattern here.
        </p>
      )}

      {insights.support === "eligible" && !insights.proposal && (
        <div className="mt-4">
          <Button variant="secondary" size="sm" disabled={analysing} onClick={() => void analyse()}>
            {analysing ? "Checking…" : "Analyze feedback"}
          </Button>
        </div>
      )}

      {error && (
        <p className="mt-3 flex items-start gap-2 text-sm text-reject">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {insights.proposal && (
        <div className="mt-6 border-t border-edge pt-5">
          <ProposalCard
            proposal={insights.proposal}
            canEdit={canEdit}
            onResolved={(resolved) => setInsights({ ...insights, proposal: resolved })}
            onProfileUpdated={onProfileUpdated}
          />
        </div>
      )}
    </Panel>
  );
}
