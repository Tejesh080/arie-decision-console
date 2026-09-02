"use client";

import { useState } from "react";
import { Download, Loader2, Sparkles } from "lucide-react";
import { exportBatchCsvText, getBatchSummary } from "@/lib/api/batches";
import type { BatchInsights } from "@/lib/api/types";
import { formatPercent, formatUsd } from "@/lib/format";
import { priorityLabel } from "@/lib/format/recommendation";
import { Panel, Eyebrow, PanelHeader } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Stat, StatRow } from "@/components/ui/Stat";

/**
 * M7 Slice 7, Parts D/E/G. Every figure below `insights` itself is
 * deterministic — the "Key insight" sentence is the one optional AI call,
 * fetched only when the customer asks for it, never on page load.
 */
export function BatchInsightsPanel({
  batchId,
  insights,
}: {
  batchId: string;
  insights: BatchInsights;
}) {
  const [summary, setSummary] = useState<string | null>(null);
  const [summarySource, setSummarySource] = useState<"ai" | "deterministic" | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);

  async function requestSummary() {
    setLoadingSummary(true);
    setSummaryError(false);
    try {
      const result = await getBatchSummary(batchId);
      setSummary(result.summary);
      setSummarySource(result.source);
    } catch {
      setSummaryError(true);
    } finally {
      setLoadingSummary(false);
    }
  }

  async function downloadCsv() {
    setExporting(true);
    setExportError(false);
    try {
      const csv = await exportBatchCsvText(batchId);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${batchId}-results.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  }

  const counts = insights.priority_counts;

  return (
    <Panel padding="lg" className="mb-6">
      <PanelHeader
        eyebrow="Insights"
        title="What this batch found"
        trailing={
          <div className="flex flex-col items-end gap-1">
            <Button variant="secondary" size="sm" disabled={exporting} onClick={downloadCsv}>
              {exporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.25} />
              ) : (
                <Download className="h-3.5 w-3.5" strokeWidth={2.25} />
              )}
              Export CSV
            </Button>
            {exportError && (
              <span className="text-xs text-reject">Couldn&apos;t export — try again.</span>
            )}
          </div>
        }
      />

      <div className="mt-5">
        <StatRow>
          <Stat
            label={priorityLabel("contact_first")}
            value={counts.contact_first}
            tone="qualify"
          />
          <Stat
            label={priorityLabel("worth_pursuing")}
            value={counts.worth_pursuing}
            tone="machine"
          />
          <Stat label={priorityLabel("review")} value={counts.review} tone="human" />
          <Stat label={priorityLabel("skip")} value={counts.skip} />
        </StatRow>
      </div>

      <div className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
        <Stat
          label="Unknown-data rate"
          value={
            insights.unknown_data_rate !== null ? formatPercent(insights.unknown_data_rate) : "—"
          }
          sub={`${insights.unknown_scoring_observations} of ${insights.expected_scoring_observations} scoring fields unresolved`}
        />
        <Stat
          label="Human review"
          value={
            insights.human_review_rate !== null ? formatPercent(insights.human_review_rate) : "—"
          }
          sub={`${insights.human_review_count} of the leads decided so far`}
        />
        <Stat
          label="Recommendation approval"
          value={
            insights.feedback_approval_rate !== null
              ? formatPercent(insights.feedback_approval_rate)
              : "Not enough feedback yet"
          }
          sub={
            insights.feedback_total > 0 ? `${insights.feedback_total} feedback given` : undefined
          }
        />
      </div>

      <div className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
        <Stat
          label="Provider calls"
          value={insights.provider_calls}
          sub={`${insights.leads_with_provider_activity} leads researched · modeled ${formatUsd(insights.modeled_provider_cost_usd)}`}
        />
        <Stat
          label="LLM calls"
          value={insights.llm_calls}
          sub={`modeled ${formatUsd(insights.modeled_llm_cost_usd)}`}
        />
      </div>
      <p className="mt-3 text-[0.6875rem] leading-relaxed text-text-faint">
        {insights.actual_provider_cost_known_calls > 0
          ? `Actual billed provider cost: ${formatUsd(insights.actual_provider_cost_usd)}.`
          : "Actual billed provider cost unavailable — figures above are ARIE's own modeled estimate."}
      </p>

      <div className="mt-6 border-t border-border pt-5">
        <Eyebrow>Key insight</Eyebrow>
        {summary ? (
          <p className="mt-2 text-sm leading-relaxed text-text">
            {summary}
            {summarySource === "deterministic" && (
              <span className="ml-1.5 text-xs text-text-faint">(deterministic summary)</span>
            )}
          </p>
        ) : (
          <div className="mt-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={loadingSummary}
              onClick={requestSummary}
              className="px-0"
            >
              {loadingSummary ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.25} />
              ) : (
                <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} />
              )}
              Generate a summary
            </Button>
            {summaryError && (
              <p className="mt-1 text-xs text-reject">
                Couldn&apos;t generate a summary — try again.
              </p>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
