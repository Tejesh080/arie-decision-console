"use client";

import { useCallback, useState } from "react";
import { CircleAlert, History } from "lucide-react";
import { acceptProposal, analyzeOutcomes, getProposal, rejectProposal } from "@/lib/api/mapping";
import { ArieApiError } from "@/lib/api/errors";
import type { ICPProfile, OutcomeAnalysis, RevisionProposal } from "@/lib/api/types";
import { Panel, Eyebrow, PanelHeader } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

/**
 * Optional: upload what happened with past companies, and see whether anything
 * in it says something about who to target.
 *
 * Two rules shape everything here. Every number shown was computed by the
 * backend deterministically — this component formats, it never calculates — and
 * a suggestion is presented as a suggestion. There is no path through this UI
 * where targeting changes without somebody pressing a button labelled with what
 * it will do.
 *
 * The language matters as much as the layout. A group with a higher positive
 * rate in one spreadsheet is an association, and the backend's own `sentence`
 * says so; this component renders that sentence rather than writing its own,
 * so there is one place where the phrasing can be got right.
 */

const SIGNAL_LABEL: Record<OutcomeAnalysis["groups"][number]["signal"], string> = {
  insufficient_data: "Not enough data",
  weak: "Weak",
  moderate: "Moderate",
  strong: "Strong",
};

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function HistoricalOutcomes({
  canEdit,
  onProfileUpdated,
}: {
  canEdit: boolean;
  onProfileUpdated?: (profile: ICPProfile) => void;
}) {
  const [analysis, setAnalysis] = useState<OutcomeAnalysis | null>(null);
  const [proposal, setProposal] = useState<RevisionProposal | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<ICPProfile | null>(null);

  const analyse = useCallback(async (file: File) => {
    setAnalysing(true);
    setError(null);
    setApplied(null);
    setProposal(null);
    try {
      const result = await analyzeOutcomes(file);
      setAnalysis(result);
      if (result.proposal_id) {
        setProposal(await getProposal(result.proposal_id));
      }
    } catch (err) {
      setError(err instanceof ArieApiError ? err.message : String(err));
      setAnalysis(null);
    } finally {
      setAnalysing(false);
    }
  }, []);

  const accept = useCallback(async () => {
    if (!proposal) return;
    setResolving(true);
    setError(null);
    try {
      const profile = await acceptProposal(proposal.proposal_id, "Updated from past results");
      setApplied(profile);
      setProposal({ ...proposal, status: "accepted" });
      onProfileUpdated?.(profile);
    } catch (err) {
      setError(err instanceof ArieApiError ? err.message : String(err));
    } finally {
      setResolving(false);
    }
  }, [proposal, onProfileUpdated]);

  const dismiss = useCallback(async () => {
    if (!proposal) return;
    setResolving(true);
    setError(null);
    try {
      setProposal(await rejectProposal(proposal.proposal_id));
    } catch (err) {
      setError(err instanceof ArieApiError ? err.message : String(err));
    } finally {
      setResolving(false);
    }
  }, [proposal]);

  return (
    <Panel className="mt-8">
      <Eyebrow>Optional</Eyebrow>
      <PanelHeader title="Have past results?" />
      <p className="mt-2 max-w-2xl text-sm text-text-dim">
        Upload previous wins, losses or customers and ARIE will look for patterns that might improve
        your targeting. A file with a company column, an outcome column and — ideally — a company
        size or industry column is enough. Nothing changes unless you choose to apply a suggestion.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <label className="sr-only" htmlFor="outcomes-file">
          Past results CSV
        </label>
        <input
          id="outcomes-file"
          type="file"
          accept=".csv,text/csv"
          disabled={!canEdit || analysing}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void analyse(file);
          }}
          className="text-sm text-text-dim file:mr-3 file:rounded-md file:border file:border-border-strong file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm file:text-text hover:file:bg-surface-3 disabled:opacity-50"
        />
        {analysing && <p className="text-xs text-text-faint">ARIE is looking for patterns…</p>}
      </div>

      {error && (
        <p className="mt-4 flex items-start gap-2 rounded-md border border-reject-edge bg-reject-dim px-3 py-2 text-sm text-text">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-reject" aria-hidden />
          {error}
        </p>
      )}

      {analysis && (
        <div className="mt-6 border-t border-edge pt-5">
          <h3 className="mb-3 flex items-center gap-2 text-[0.8125rem] font-medium uppercase tracking-wide text-text-dim">
            <History className="size-4" aria-hidden />
            Historical signals
          </h3>

          <p className="text-sm text-text">
            {analysis.labelled_rows} past results with an outcome ARIE could read —{" "}
            {analysis.positive_count} positive, {analysis.negative_count} not. Your overall positive
            rate is {percent(analysis.baseline_rate)}.
          </p>

          {analysis.interpretation && (
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-text">
              {analysis.interpretation}
            </p>
          )}

          {analysis.groups.length > 0 && (
            <ul className="mt-4 flex flex-col gap-3">
              {analysis.groups.map((group) => (
                <li
                  key={`${group.dimension}-${group.group_key}`}
                  className="rounded-md border border-edge px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-medium text-text">
                      {group.group_label.charAt(0).toUpperCase() + group.group_label.slice(1)}
                    </span>
                    <Badge>{SIGNAL_LABEL[group.signal]}</Badge>
                    <span className="text-xs text-text-faint">
                      {group.sample_size} examples · {percent(group.positive_rate)} positive ·{" "}
                      {percent(analysis.baseline_rate)} overall
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-text-dim">{group.sentence}</p>
                </li>
              ))}
            </ul>
          )}

          {analysis.warnings.map((warning) => (
            <p key={warning} className="mt-3 text-xs text-text-faint">
              {warning}
            </p>
          ))}

          {Object.keys(analysis.unrecognised_labels).length > 0 && (
            <p className="mt-3 text-xs text-text-faint">
              Outcome labels ARIE did not recognise:{" "}
              {Object.entries(analysis.unrecognised_labels)
                .map(([label, count]) => `${label} (${count})`)
                .join(", ")}
              .
            </p>
          )}

          {!proposal && !analysing && (
            <p className="mt-4 text-sm text-text-dim">
              ARIE has no targeting change to suggest from this data.
            </p>
          )}
        </div>
      )}

      {proposal && (
        <div className="mt-6 border-t border-edge pt-5">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="text-[0.8125rem] font-medium uppercase tracking-wide text-text-dim">
              Possible improvement
            </h3>
            <Badge>{proposal.status === "proposed" ? "Suggestion" : proposal.status}</Badge>
            <span className="text-xs text-text-faint">
              {SIGNAL_LABEL[proposal.evidence_strength]} evidence · {proposal.sample_size} examples
            </span>
          </div>

          <p className="text-[0.9375rem] leading-relaxed text-text">{proposal.summary}</p>

          <ul className="mt-4 flex flex-col gap-2">
            {proposal.changes.map((change) => (
              <li key={`${change.kind}-${change.target}`} className="text-sm text-text">
                <span className="font-medium">
                  {change.target_label.charAt(0).toUpperCase() + change.target_label.slice(1)}
                </span>{" "}
                <span className="text-text-dim">
                  — {change.from_value.replace(/_/g, " ")} → {change.to_value.replace(/_/g, " ")}
                </span>
                <p className="mt-0.5 text-xs text-text-faint">{change.rationale}</p>
              </li>
            ))}
          </ul>

          {proposal.caveats.map((caveat) => (
            <p key={caveat} className="mt-3 text-xs text-text-faint">
              {caveat}
            </p>
          ))}

          {proposal.status === "proposed" ? (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button onClick={() => void accept()} disabled={resolving || !canEdit}>
                {resolving ? "Applying…" : "Apply this change"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => void dismiss()}
                disabled={resolving || !canEdit}
              >
                Not now
              </Button>
              <span className="text-xs text-text-faint">
                Applying creates a new targeting version. Nothing has changed yet.
              </span>
            </div>
          ) : (
            <p className="mt-5 text-sm text-text-dim">
              {proposal.status === "accepted"
                ? `Applied${applied ? ` as version ${applied.version}` : ""}.`
                : "Dismissed. Your targeting is unchanged."}
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}
