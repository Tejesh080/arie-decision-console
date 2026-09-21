import type { LeadRecommendationResponse } from "@/lib/api/types";
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

const PRIORITY_ACCENT = {
  contact_first: "qualify",
  worth_pursuing: "machine",
  review: "human",
  skip: "reject",
} as const;

/**
 * A read-only twin of `RecommendationPanel` (`src/components/lead/
 * RecommendationPanel.tsx`) for the frozen `/demo` scenarios.
 *
 * The real panel is more than a summary — it embeds "Ask ARIE about this
 * lead", the useful/not-useful feedback buttons, "Check research options",
 * and "Generate detailed explanation", every one of which calls the live
 * API (`getExplanation`, `askLeadCopilot`, `submitLeadFeedback`,
 * `getResearchPlan`/`executeResearch`) the moment a visitor clicks it. On an
 * unauthenticated, zero-session page that must never reach the real
 * backend, wiring any of those in would violate the one hard rule this
 * route has, so this component reproduces only the parts of the real panel
 * that are pure rendering of already-known data: the priority badge,
 * confidence band, the "why", next action / research status, and key /
 * missing evidence. Same design language and formatting helpers as the
 * original, deliberately without an interactive surface.
 */
export function DemoRecommendationSummary({
  recommendation,
}: {
  recommendation: LeadRecommendationResponse;
}) {
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
          {/* Raw machine call and evidence sufficiency, kept visibly separate
              from the derived customer-facing priority above — never one
              ambiguous badge. See RecommendationPanel's identical pairing. */}
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

      <div className="mt-5">
        <Eyebrow>Why</Eyebrow>
        <p className="mt-1.5 text-sm leading-relaxed text-text-dim">
          {recommendation.short_reason}
        </p>
      </div>

      <div className="mt-5 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
        <div>
          <Eyebrow>Next</Eyebrow>
          <p className="mt-1 text-sm text-text">{nextActionLabel(recommendation.next_action)}</p>
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

      <p className="mt-5 border-t border-border pt-3 text-[0.6875rem] leading-relaxed text-text-faint">
        This demo doesn&apos;t wire up Ask ARIE, feedback, or research actions — each of those
        calls the live API on a real lead, which this frozen page deliberately never does.
      </p>
    </Panel>
  );
}
