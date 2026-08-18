"use client";

import { useState } from "react";
import { motion } from "motion/react";
import type { ReceiptResponse, ReviewAction, ReviewResponse } from "@/lib/api/types";
import { submitReviewDecision } from "@/lib/api/reviews";
import { ArieApiError, ArieConflictError, ArieValidationError } from "@/lib/api/errors";
import { decisionLabel, reviewActionLabel, toneForStatus } from "@/lib/format/decision";
import { statusLabel } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Eyebrow, Panel } from "@/components/ui/Panel";

interface Props {
  review: ReviewResponse;
  receipt: ReceiptResponse;
  onDecided: () => void;
  onConflict: (message: string) => void;
}

const ACTIONS: { value: ReviewAction; label: string; tone: "qualify" | "reject" | "human" }[] = [
  { value: "approve", label: "Approve", tone: "qualify" },
  { value: "reject", label: "Reject", tone: "reject" },
  { value: "edit", label: "Edit", tone: "human" },
];

export function HumanReviewPanel({ review, receipt, onDecided, onConflict }: Props) {
  if (!review.is_pending) {
    return <ResolvedSequence review={review} receipt={receipt} />;
  }
  return (
    <PendingReviewForm
      review={review}
      receipt={receipt}
      onDecided={onDecided}
      onConflict={onConflict}
    />
  );
}

function PendingReviewForm({ review, receipt, onDecided, onConflict }: Props) {
  const [reviewer, setReviewer] = useState("arie-web");
  const [action, setAction] = useState<ReviewAction>("approve");
  const [notes, setNotes] = useState("");
  const [armed, setArmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const notesRequired = action === "edit";
  const canSubmit = reviewer.trim().length > 0 && (!notesRequired || notes.trim().length > 0);

  function pickAction(next: ReviewAction) {
    setAction(next);
    setArmed(false);
    setError(null);
  }

  async function handleSubmitClick() {
    if (!canSubmit) return;
    if (!armed) {
      setArmed(true);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await submitReviewDecision(review.review_id, {
        action,
        reviewer: reviewer.trim(),
        notes: notes.trim() || null,
        expected_lead_version: review.lead_version,
      });
      void result;
      onDecided();
    } catch (err) {
      if (err instanceof ArieConflictError) {
        onConflict(
          "This review changed since you loaded it — someone else may have already decided it, or the lead moved on. Showing the latest state.",
        );
      } else if (err instanceof ArieValidationError) {
        setError(err.message);
      } else if (err instanceof ArieApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong submitting this decision.");
      }
    } finally {
      setSubmitting(false);
      setArmed(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SequenceStage
        role="machine"
        title="Machine recommendation"
        headline={decisionLabel(receipt.decision?.recommended_action ?? "—")}
      >
        <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-sm">
          <dt className="text-text-faint">Autonomous?</dt>
          <dd className="text-text">{receipt.decision?.autonomous ? "Yes" : "No"}</dd>
          <dt className="text-text-faint">Why?</dt>
          <dd className="text-text-dim">{receipt.stopping?.explanation ?? "—"}</dd>
        </dl>
      </SequenceStage>

      <Connector />

      <Panel accent="human">
        <Eyebrow>Human review required</Eyebrow>
        <p className="mt-1 text-sm text-text-dim">
          Confidence did not clear the autonomy threshold. A person needs to decide.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-dim">Reviewer</span>
            <input
              value={reviewer}
              onChange={(e) => {
                setReviewer(e.target.value);
                setArmed(false);
              }}
              className="input"
              placeholder="your name"
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-dim">Action</span>
            <div className="flex gap-2">
              {ACTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => pickAction(opt.value)}
                  className={
                    "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors " +
                    (action === opt.value
                      ? opt.tone === "qualify"
                        ? "border-qualify bg-qualify-dim text-qualify"
                        : opt.tone === "reject"
                          ? "border-reject bg-reject-dim text-reject"
                          : "border-human bg-human-dim text-human"
                      : "border-border text-text-dim hover:border-border-strong hover:text-text")
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {notesRequired && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-dim">
                Notes <span className="text-human">* required for edit</span>
              </span>
              <textarea
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setArmed(false);
                }}
                className="textarea"
                placeholder="Explain the override — this becomes part of the audit trail."
              />
            </label>
          )}
          {!notesRequired && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-dim">Notes (optional)</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="textarea"
              />
            </label>
          )}

          {error && (
            <p className="rounded-lg border border-reject/40 bg-reject-dim px-3 py-2 text-sm text-text">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={!canSubmit || submitting}
              onClick={handleSubmitClick}
              className="rounded-lg bg-human px-4 py-2 text-sm font-semibold text-bg transition-transform hover:scale-[1.02] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100"
            >
              {submitting ? "Submitting…" : armed ? `Confirm ${action}` : "Submit decision"}
            </button>
            {armed && !submitting && (
              <button
                type="button"
                onClick={() => setArmed(false)}
                className="text-sm text-text-dim underline underline-offset-4 hover:text-text"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}

function ResolvedSequence({
  review,
  receipt,
}: {
  review: ReviewResponse;
  receipt: ReceiptResponse;
}) {
  const finalTone = toneForStatus(receipt.lead_status);
  return (
    <div className="flex flex-col gap-4">
      <SequenceStage
        role="machine"
        title="Machine recommendation"
        headline={decisionLabel(receipt.decision?.recommended_action ?? "—")}
      />
      <Connector />
      <SequenceStage
        role="human"
        title={`Human action — ${review.reviewer ?? "unknown reviewer"}`}
        headline={reviewActionLabel(receiptActionFromReview(review))}
      >
        {review.notes && <p className="mt-2 text-sm text-text-dim">“{review.notes}”</p>}
      </SequenceStage>
      <Connector />
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
        <SequenceStage
          role={finalTone === "reject" ? "reject" : "final"}
          title="Final outcome"
          headline={statusLabel(receipt.lead_status)}
        >
          {receipt.decision?.human_override && (
            <div className="mt-2">
              <Badge tone="human">Human override — machine recommended differently</Badge>
            </div>
          )}
        </SequenceStage>
      </motion.div>
    </div>
  );
}

function receiptActionFromReview(review: ReviewResponse): string {
  if (review.final_decision === "auto_route") return "approve";
  if (review.final_decision === "manual_review") return "edit";
  return "reject";
}

function SequenceStage({
  role,
  title,
  headline,
  children,
}: {
  role: "machine" | "human" | "final" | "reject";
  title: string;
  headline: string;
  children?: React.ReactNode;
}) {
  const border =
    role === "machine"
      ? "border-l-machine"
      : role === "human"
        ? "border-l-human"
        : role === "reject"
          ? "border-l-reject"
          : "border-l-qualify";
  const color =
    role === "machine"
      ? "text-machine"
      : role === "human"
        ? "text-human"
        : role === "reject"
          ? "text-reject"
          : "text-qualify";

  return (
    <div className={`rounded-xl border border-border border-l-2 ${border} bg-panel p-5`}>
      <Eyebrow>{title}</Eyebrow>
      <p className={`mt-1 font-display text-2xl font-medium ${color}`}>{headline}</p>
      {children}
    </div>
  );
}

function Connector() {
  return (
    <div className="flex justify-center">
      <div className="h-6 w-px bg-border-strong" />
    </div>
  );
}
