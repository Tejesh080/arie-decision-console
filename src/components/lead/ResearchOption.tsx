"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { executeResearch, getResearchPlan } from "@/lib/api/leads";
import type { ResearchExecutionResponse, ResearchPlanResponse } from "@/lib/api/types";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Panel";

/**
 * "Is another piece of evidence worth acquiring at all?" — M7 Slice 5.
 *
 * Never fetches a plan on mount: checking is a deliberate action (it may, in
 * the rare ambiguous case, spend an AI budget), never something that happens
 * just because a customer opened the lead page. `approved` on the response
 * is the only thing that ever shows a "Research this" button — this
 * component never re-derives whether research is allowed.
 */
export function ResearchOption({ leadId }: { leadId: string }) {
  const [plan, setPlan] = useState<ResearchPlanResponse | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<ResearchExecutionResponse | null>(null);
  const [error, setError] = useState(false);

  async function checkResearchOptions() {
    setLoadingPlan(true);
    setError(false);
    try {
      setPlan(await getResearchPlan(leadId));
    } catch {
      setError(true);
    } finally {
      setLoadingPlan(false);
    }
  }

  async function runResearch() {
    if (!plan?.target_field) return;
    setExecuting(true);
    setError(false);
    try {
      setResult(await executeResearch(leadId, plan.target_field));
    } catch {
      setError(true);
    } finally {
      setExecuting(false);
    }
  }

  if (result) {
    return (
      <div className="mt-3 surface-flat p-3">
        <Eyebrow>Research completed</Eyebrow>
        <p className="mt-1.5 text-sm text-text-dim">{result.detail}</p>
        {result.preview && (
          <p className="mt-2 text-sm text-text">
            With this new information, the score would be{" "}
            <span className="t-metric">{result.preview.score.toFixed(1)}</span> —{" "}
            {result.preview.likely_outcome === "qualifies"
              ? "above your qualify threshold."
              : result.preview.likely_outcome === "rejects"
                ? "still below your reject threshold."
                : "still borderline."}
          </p>
        )}
        <p className="mt-2 text-[0.6875rem] text-text-faint">
          This is a preview only — the lead&apos;s official recommendation above is unchanged until
          it is reprocessed.
        </p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="mt-3">
        <Button
          variant="ghost"
          size="sm"
          disabled={loadingPlan}
          onClick={checkResearchOptions}
          className="px-0"
        >
          {loadingPlan ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.25} />
          ) : (
            <Search className="h-3.5 w-3.5" strokeWidth={2.25} />
          )}
          Check research options
        </Button>
        {error && (
          <p className="mt-1 text-xs text-reject">
            Couldn&apos;t check research options — try again.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 surface-flat p-3">
      {plan.question && (
        <>
          <Eyebrow>Research option</Eyebrow>
          <p className="mt-1.5 text-sm text-text">{plan.question}</p>
        </>
      )}
      <p className="mt-1.5 text-xs text-text-faint">{plan.detail}</p>
      {plan.approved ? (
        <div className="mt-2.5 flex items-center gap-3">
          <Button variant="secondary" size="sm" disabled={executing} onClick={runResearch}>
            {executing && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.25} />}
            Research this
          </Button>
          {plan.estimated_cost_usd && (
            <span className="text-xs text-text-faint">
              Estimated cost: ${plan.estimated_cost_usd}
            </span>
          )}
        </div>
      ) : (
        error && <p className="mt-1 text-xs text-reject">Couldn&apos;t run research — try again.</p>
      )}
    </div>
  );
}
