"use client";

import { ChevronRight } from "lucide-react";
import type { DemoScenario } from "@/lib/demo/scenarios";
import { formatDateTime, formatUsd } from "@/lib/format";
import { costCaveat, costNoun, isSimulated } from "@/lib/api/providerMode";
import { Eyebrow, Panel } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { IdChip } from "@/components/ui/CopyButton";
import { ScoreBand } from "@/components/receipt/Gauges";
import { VerdictPanel } from "@/components/receipt/VerdictPanel";
import { StopFlow } from "@/components/receipt/StopFlow";
import { WhoDecided } from "@/components/receipt/WhoDecided";
import { EvidencePanel } from "@/components/receipt/EvidencePanel";
import { HumanReviewPanel } from "@/components/receipt/HumanReviewPanel";
import { DemoRecommendationSummary } from "@/components/demo/DemoRecommendationSummary";

/**
 * The real rendering of a real decision receipt, fed one of the three
 * frozen `DemoScenario`s instead of a live fetch.
 *
 * This deliberately mirrors the "decided" branch of `DecisionReceiptView`
 * (`src/components/DecisionReceiptView.tsx`) panel-for-panel — same
 * `VerdictPanel`/`StopFlow`/`ScoreBand`/`EvidencePanel`/`WhoDecided`/
 * `HumanReviewPanel`, same "Advanced details" / "Developer details"
 * structure — rather than inventing a parallel look for the demo. What's
 * missing on purpose is everything `DecisionReceiptView` does *around* those
 * panels: there is no fetch, no polling, no loading/error state, and no
 * `RecommendationPanel` (replaced by the read-only `DemoRecommendationSummary`
 * — see that file for why).
 *
 * `HumanReviewPanel` is safe to reuse as-is here: every `DemoScenario` with a
 * `human_review` also carries an already-resolved `review`
 * (`is_pending: false`), so it renders `HumanReviewPanel`'s pure
 * `ResolvedSequence` branch, never the pending form that calls
 * `submitReviewDecision`.
 */
export function DemoReceiptView({ scenario }: { scenario: DemoScenario }) {
  const { receipt, recommendation, review, lead } = scenario;
  const showHumanReview = Boolean(receipt.human_review && review && !receipt.shadow);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Eyebrow>Decision receipt · frozen sample</Eyebrow>
        <div className="mt-1.5 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="t-h1 min-w-0 break-words text-text">{lead.full_name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-faint">
              <span className="t-data">{lead.email}</span>
              <span>{lead.company_name}</span>
              <IdChip value={receipt.lead_id} truncate />
            </div>
          </div>
          <StatusPill status={receipt.lead_status} />
        </div>
      </div>

      {recommendation && <DemoRecommendationSummary recommendation={recommendation} />}

      {showHumanReview && review ? (
        <HumanReviewPanel
          review={review}
          receipt={receipt}
          onDecided={() => {}}
          onConflict={() => {}}
        />
      ) : (
        <WhoDecided receipt={receipt} />
      )}

      {/* Advanced Details: open by default here, since this whole page's
          purpose is to show the machine recommendation, provider ledger, and
          provenance a hiring manager wouldn't otherwise get past a login
          wall to see. */}
      <details className="group/advanced" open>
        <summary className="surface-flat flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 transition-colors hover:border-border-loud">
          <span className="min-w-0">
            <Eyebrow>Advanced details</Eyebrow>
            <span className="mt-1 block text-sm text-text-dim">
              The Decision Receipt — score, stopping reason, evidence, cost, and provenance
            </span>
          </span>
          <ChevronRight
            aria-hidden
            className="h-4 w-4 shrink-0 text-text-faint transition-transform duration-200 group-open/advanced:rotate-90"
            strokeWidth={2}
          />
        </summary>

        <div className="mt-4 flex flex-col gap-5">
          <VerdictPanel receipt={receipt} />

          <StopFlow receipt={receipt} />

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
            <div className="flex min-w-0 flex-col gap-5">
              <Panel as="section">
                <Eyebrow>Scoring</Eyebrow>
                <h2 className="t-h3 mt-1.5 text-text">Where the score landed</h2>
                <div className="mt-5">
                  {receipt.score && (
                    <ScoreBand
                      value={receipt.score.value}
                      lower={receipt.score.bounds.lower}
                      upper={receipt.score.bounds.upper}
                      thresholdReject={receipt.score.threshold_reject}
                      thresholdQualify={receipt.score.threshold_qualify}
                    />
                  )}
                </div>
              </Panel>

              <details className="group/evidence">
                <summary className="surface-flat flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 transition-colors hover:border-border-loud">
                  <span className="min-w-0">
                    <Eyebrow>Evidence</Eyebrow>
                    <span className="mt-1 block text-sm text-text-dim">
                      Every check ARIE made, what each returned, and what each cost
                    </span>
                  </span>
                  <ChevronRight
                    aria-hidden
                    className="h-4 w-4 shrink-0 text-text-faint transition-transform duration-200 group-open/evidence:rotate-90"
                    strokeWidth={2}
                  />
                </summary>
                <div className="mt-4">
                  <EvidencePanel providers={receipt.providers} evidence={receipt.evidence} />
                </div>
              </details>
            </div>

            <aside className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-20 lg:self-start">
              <p className="t-label text-text-faint">Technical details</p>
              <Panel padding="sm">
                <Eyebrow>{costNoun()}</Eyebrow>
                <dl className="mt-3 flex flex-col gap-2 text-sm">
                  <CostRow label="Providers" value={formatUsd(receipt.cost.provider_cost_usd)} />
                  <CostRow label="Model" value={formatUsd(receipt.cost.model_cost_usd)} />
                  <CostRow label="Total" value={formatUsd(receipt.cost.total_cost_usd)} strong />
                  <CostRow
                    label="Budget cap"
                    value={formatUsd(receipt.cost.budget_usd_cap)}
                    muted
                  />
                </dl>
                {isSimulated() && (
                  <p className="mt-3 border-t border-border pt-2.5 text-[0.6875rem] leading-relaxed text-text-faint">
                    {costCaveat()}
                  </p>
                )}
              </Panel>

              <Panel padding="sm">
                <Eyebrow>Provenance</Eyebrow>
                <dl className="mt-3 flex flex-col gap-2 text-sm">
                  <CostRow label="Policy" value={receipt.versions?.policy ?? "—"} mono />
                  <CostRow label="Scorer" value={receipt.versions?.scorer ?? "—"} mono />
                  <CostRow
                    label="Calibration"
                    value={receipt.versions?.confidence_calibration ?? "—"}
                    mono
                  />
                  <CostRow label="Receipt" value={`v${receipt.receipt_version}`} mono muted />
                  {receipt.stopping && (
                    <CostRow label="Stop rule" value={receipt.stopping.reason_code} mono muted />
                  )}
                </dl>
                <div className="mt-3 flex flex-col gap-1 border-t border-border pt-2.5">
                  <span className="text-xs text-text-faint">Lead ID</span>
                  <IdChip value={receipt.lead_id} truncate />
                </div>
                <p className="mt-3 border-t border-border pt-2.5 text-[0.6875rem] text-text-faint">
                  Decided {formatDateTime(receipt.created_at)}
                </p>
              </Panel>

              {receipt.human_review && (
                <Panel padding="sm">
                  <Eyebrow>Review record</Eyebrow>
                  <div className="mt-3 flex flex-col gap-2 text-sm">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-text-faint">Review ID</span>
                      <IdChip value={receipt.human_review.review_id} truncate />
                    </div>
                    <CostRow
                      label="Reviewer"
                      value={receipt.human_review.reviewer ?? "Unassigned"}
                    />
                    <CostRow
                      label="Responded"
                      value={
                        receipt.human_review.responded_at
                          ? formatDateTime(receipt.human_review.responded_at)
                          : "Pending"
                      }
                    />
                  </div>
                </Panel>
              )}

              <details className="surface-flat group px-4 py-3">
                <summary className="t-label flex cursor-pointer list-none items-center gap-1.5 text-text-faint transition-colors hover:text-text-dim">
                  <ChevronRight
                    aria-hidden
                    className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-90"
                    strokeWidth={2.25}
                  />
                  Developer details
                </summary>
                <p className="mt-2 text-[0.6875rem] leading-relaxed text-text-faint">
                  The exact shape of a{" "}
                  <code className="t-data">GET /leads/{"{id}"}/receipt</code> response — this one
                  frozen, never fetched.
                </p>
                <pre className="scroll-x mt-2 max-h-80 overflow-y-auto rounded-md border border-border bg-bg-sunken p-3 text-[0.6875rem] leading-relaxed text-text-dim">
                  {JSON.stringify(receipt, null, 2)}
                </pre>
              </details>
            </aside>
          </div>
        </div>
      </details>
    </div>
  );
}

function CostRow({
  label,
  value,
  strong,
  muted,
  mono,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
  mono?: boolean;
}) {
  return (
    <div
      className={
        strong
          ? "flex items-baseline justify-between gap-3 border-t border-border pt-2"
          : "flex items-baseline justify-between gap-3"
      }
    >
      <dt className="shrink-0 text-xs text-text-faint">{label}</dt>
      <dd
        className={`t-data min-w-0 truncate text-right ${
          muted ? "text-text-faint" : strong ? "text-text" : "text-text-dim"
        } ${mono ? "" : "tabular-nums"}`}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
