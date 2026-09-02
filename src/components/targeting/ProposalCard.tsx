"use client";

import { useCallback, useState } from "react";
import { acceptProposal, rejectProposal } from "@/lib/api/mapping";
import { ArieApiError } from "@/lib/api/errors";
import type { ICPProfile, RevisionProposal } from "@/lib/api/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

/**
 * M7 Slice 7, Part J — one rendering for any `RevisionProposal`, whichever
 * `source` produced it (`historical_outcomes` or `user_feedback`). Extracted
 * from `HistoricalOutcomes` so a suggestion reads and behaves identically
 * everywhere it can appear — same accept/dismiss route, same "nothing has
 * changed yet" language, same current -> proposed rendering.
 */

const SIGNAL_LABEL: Record<RevisionProposal["evidence_strength"], string> = {
  insufficient_data: "Not enough data",
  weak: "Weak",
  moderate: "Moderate",
  strong: "Strong",
};

const SOURCE_LABEL: Record<string, string> = {
  historical_outcomes: "From your past results",
  user_feedback: "Based on your feedback",
};

export function ProposalCard({
  proposal,
  canEdit,
  onResolved,
  onProfileUpdated,
}: {
  proposal: RevisionProposal;
  canEdit: boolean;
  onResolved?: (proposal: RevisionProposal) => void;
  onProfileUpdated?: (profile: ICPProfile) => void;
}) {
  const [current, setCurrent] = useState(proposal);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<ICPProfile | null>(null);

  const accept = useCallback(async () => {
    setResolving(true);
    setError(null);
    try {
      const profile = await acceptProposal(current.proposal_id, "Applied from suggestion");
      setApplied(profile);
      const resolved = { ...current, status: "accepted" as const };
      setCurrent(resolved);
      onResolved?.(resolved);
      onProfileUpdated?.(profile);
    } catch (err) {
      setError(err instanceof ArieApiError ? err.message : String(err));
    } finally {
      setResolving(false);
    }
  }, [current, onResolved, onProfileUpdated]);

  const dismiss = useCallback(async () => {
    setResolving(true);
    setError(null);
    try {
      const resolved = await rejectProposal(current.proposal_id);
      setCurrent(resolved);
      onResolved?.(resolved);
    } catch (err) {
      setError(err instanceof ArieApiError ? err.message : String(err));
    } finally {
      setResolving(false);
    }
  }, [current, onResolved]);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-[0.8125rem] font-medium tracking-wide text-text-dim uppercase">
          {SOURCE_LABEL[current.source] ?? "Suggestion"}
        </h3>
        <Badge>{current.status === "proposed" ? "Suggestion" : current.status}</Badge>
        <span className="text-xs text-text-faint">
          {SIGNAL_LABEL[current.evidence_strength]} evidence · {current.sample_size} examples
        </span>
      </div>

      <p className="text-[0.9375rem] leading-relaxed text-text">{current.summary}</p>

      <ul className="mt-4 flex flex-col gap-2">
        {current.changes.map((change) => (
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

      {current.caveats.map((caveat) => (
        <p key={caveat} className="mt-3 text-xs text-text-faint">
          {caveat}
        </p>
      ))}

      {error && <p className="mt-3 text-sm text-reject">{error}</p>}

      {current.status === "proposed" ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button onClick={() => void accept()} disabled={resolving || !canEdit}>
            {resolving ? "Applying…" : "Apply this change"}
          </Button>
          <Button variant="ghost" onClick={() => void dismiss()} disabled={resolving || !canEdit}>
            Not now
          </Button>
          <span className="text-xs text-text-faint">
            Applying creates a new targeting version. Nothing has changed yet.
          </span>
        </div>
      ) : (
        <p className="mt-5 text-sm text-text-dim">
          {current.status === "accepted"
            ? `Applied${applied ? ` as version ${applied.version}` : ""}.`
            : "Dismissed. Your targeting is unchanged."}
        </p>
      )}
    </div>
  );
}
