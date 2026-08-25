"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import clsx from "clsx";
import type { ReceiptResponse, ReviewAction, ReviewResponse } from "@/lib/api/types";
import { submitReviewDecision } from "@/lib/api/reviews";
import { ArieApiError, ArieConflictError, ArieValidationError } from "@/lib/api/errors";
import {
  decisionLabel,
  reviewActionLabel,
  reviewerNote,
  toneForStatus,
} from "@/lib/format/decision";
import { formatPercent, formatScore, statusLabel } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Panel";
import { Chain, Connector, Stage, type StageRole } from "./DecisionChain";

interface Props {
  review: ReviewResponse;
  receipt: ReceiptResponse;
  onDecided: () => void;
  onConflict: (message: string) => void;
}

const ACTIONS: {
  value: ReviewAction;
  label: string;
  tone: "qualify" | "reject" | "human";
  blurb: string;
}[] = [
  {
    value: "approve",
    label: "Approve",
    tone: "qualify",
    blurb: "Accept ARIE's recommendation and let it act on it.",
  },
  {
    value: "reject",
    label: "Reject",
    tone: "reject",
    blurb: "Turn this lead down.",
  },
  {
    value: "edit",
    label: "Edit",
    tone: "human",
    blurb: "Override with a manual outcome. A note is required.",
  },
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

/* -------------------------------------------------------------- pending -- */

function PendingReviewForm({ review, receipt, onDecided, onConflict }: Props) {
  // Deliberately empty: the old default was the literal source identifier
  // "arie-web", which then rendered as "Human action — arie-web" on real
  // receipts — a machine name standing where accountability belongs.
  const [reviewer, setReviewer] = useState("");
  const [action, setAction] = useState<ReviewAction>("approve");
  const [notes, setNotes] = useState("");
  const [armed, setArmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const notesRequired = action === "edit";
  const canSubmit = reviewer.trim().length > 0 && (!notesRequired || notes.trim().length > 0);
  const selected = ACTIONS.find((a) => a.value === action)!;

  function pickAction(next: ReviewAction) {
    setAction(next);
    // Changing what you are about to do must always disarm the confirm --
    // otherwise a second click could commit an action the reviewer never
    // confirmed.
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
      await submitReviewDecision(review.review_id, {
        action,
        reviewer: reviewer.trim(),
        notes: notes.trim() || null,
        expected_lead_version: review.lead_version,
      });
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
    <Chain>
      <Stage
        role="machine"
        label="Machine recommendation"
        headline={decisionLabel(receipt.decision?.recommended_action ?? "—")}
        index={0}
      >
        <p className="mt-2 text-sm leading-relaxed text-text-dim">
          {receipt.stopping?.explanation ?? "—"}
        </p>
      </Stage>

      <Connector label="Confidence below threshold — escalated" index={1} />

      <Stage
        role="human"
        label="Human review required"
        headline="Awaiting your decision"
        index={1}
        trailing={
          <Badge tone="human">
            <TriangleAlert aria-hidden className="h-3 w-3" strokeWidth={2.25} />
            Action needed
          </Badge>
        }
      >
        {/* Everything a reviewer must see *before* they act: why they are
            being asked, the recommendation, the numbers behind it, and how
            much evidence it rests on. Deciding above the fold without this
            context is how rubber-stamping happens. */}
        {receipt.score && (
          <p className="mt-3 text-sm leading-relaxed text-text-dim">
            You&apos;re being asked because ARIE&apos;s confidence (
            {formatPercent(receipt.score.confidence)}) fell short of the{" "}
            {formatPercent(receipt.score.tau)} it needs to act alone
            {receipt.evidence.unknown_fields.length > 0 && (
              <>
                {" "}
                — {receipt.evidence.unknown_fields.length} field
                {receipt.evidence.unknown_fields.length === 1
                  ? " it wanted is"
                  : "s it wanted are"}{" "}
                still unknown
              </>
            )}
            . Its recommendation is preserved below either way; your decision is what actually
            happens.
          </p>
        )}
        {receipt.score && (
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-md border border-border bg-bg-sunken p-4 sm:grid-cols-4">
            <Fact label="Score" value={formatScore(receipt.score.value)} />
            <Fact
              label="Confidence"
              value={formatPercent(receipt.score.confidence)}
              tone="text-human"
            />
            <Fact label="Automation threshold" value={formatPercent(receipt.score.tau)} />
            <Fact
              label="Evidence"
              value={`${receipt.evidence.items.length} fields`}
              hint={`${receipt.evidence.unknown_fields.length} unknown`}
            />
          </dl>
        )}

        <div className="mt-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-dim">Reviewer</span>
            <input
              value={reviewer}
              onChange={(e) => {
                setReviewer(e.target.value);
                setArmed(false);
              }}
              className="input"
              placeholder="Your name — required"
            />
            <span className="text-[0.6875rem] text-text-faint">
              Recorded on the receipt as the person accountable for this call.
            </span>
          </label>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-xs font-medium text-text-dim">Action</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {ACTIONS.map((opt) => {
                const on = action === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => pickAction(opt.value)}
                    aria-pressed={on}
                    className={clsx(
                      "rounded-md border px-3 py-2 text-sm font-medium transition-[background-color,border-color,color] duration-[130ms]",
                      on
                        ? opt.tone === "qualify"
                          ? "border-qualify bg-qualify-dim text-qualify"
                          : opt.tone === "reject"
                            ? "border-reject bg-reject-dim text-reject"
                            : "border-human bg-human-dim text-human"
                        : "border-border-strong text-text-dim hover:border-border-loud hover:text-text",
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[0.6875rem] text-text-faint">{selected.blurb}</p>
          </fieldset>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-dim">
              Notes{" "}
              {notesRequired ? (
                <span className="text-human">— required for an edit</span>
              ) : (
                <span className="text-text-faint">(optional)</span>
              )}
            </span>
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setArmed(false);
              }}
              className="textarea"
              placeholder={
                notesRequired
                  ? "Explain the override — this becomes part of the audit trail."
                  : "Anything worth recording alongside this decision."
              }
            />
          </label>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-2 rounded-md border border-reject-edge bg-reject-dim px-3 py-2 text-sm text-text"
              >
                <CircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-reject" />
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Two-step arm-then-confirm. The label changes to name the exact
              action being committed, so the confirming click is never
              ambiguous about what it approves. */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant={armed ? (action === "reject" ? "danger" : "human") : "secondary"}
              disabled={!canSubmit || submitting}
              onClick={handleSubmitClick}
            >
              {submitting ? (
                "Submitting…"
              ) : armed ? (
                <>
                  <ShieldCheck className="h-4 w-4" strokeWidth={2.25} />
                  Confirm {action}
                </>
              ) : (
                "Submit decision"
              )}
            </Button>
            <AnimatePresence>
              {armed && !submitting && (
                <motion.div
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-3"
                >
                  <Button type="button" variant="ghost" size="sm" onClick={() => setArmed(false)}>
                    Cancel
                  </Button>
                  <span className="text-xs text-text-faint">
                    This is recorded permanently and cannot be undone here.
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </Stage>
    </Chain>
  );
}

function Fact({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <p className={clsx("t-metric mt-1.5 text-lg", tone ?? "text-text")}>{value}</p>
      {hint && <p className="mt-0.5 text-[0.6875rem] text-text-faint">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------- resolved -- */

function ResolvedSequence({
  review,
  receipt,
}: {
  review: ReviewResponse;
  receipt: ReceiptResponse;
}) {
  const finalTone = toneForStatus(receipt.lead_status);
  const note = reviewerNote(review.notes);
  const finalRole: StageRole =
    finalTone === "reject" ? "reject" : finalTone === "human" ? "human" : "final";

  return (
    <Chain>
      <Stage
        role="machine"
        label="Machine recommendation"
        headline={decisionLabel(receipt.decision?.recommended_action ?? "—")}
        index={0}
      >
        <p className="mt-2 text-sm text-text-faint">
          What ARIE would have done on its own. Preserved exactly as recommended, whatever happened
          next.
        </p>
      </Stage>

      <Connector label="Escalated to a person" index={1} />

      <Stage
        role="human"
        label={`Human action — ${review.reviewer ?? "unknown reviewer"}`}
        headline={reviewActionLabel(receiptActionFromReview(review))}
        index={1}
      >
        {note ? (
          <blockquote className="mt-3 border-l-2 border-human-edge pl-3 text-sm leading-relaxed text-text-dim">
            {note}
          </blockquote>
        ) : (
          <p className="mt-2 text-sm text-text-faint">No reviewer note</p>
        )}
      </Stage>

      <Connector index={2} />

      <Stage
        role={finalRole}
        label="Final outcome"
        headline={statusLabel(receipt.lead_status)}
        index={2}
        trailing={
          receipt.decision?.human_override ? (
            <Badge tone="human">Human override</Badge>
          ) : (
            <Badge tone="neutral">Recommendation upheld</Badge>
          )
        }
      >
        <p className="mt-2 text-sm text-text-faint">
          {receipt.decision?.human_override
            ? "The reviewer decided differently from ARIE. Both records stand."
            : "The reviewer agreed with ARIE's recommendation."}
        </p>
      </Stage>
    </Chain>
  );
}

function receiptActionFromReview(review: ReviewResponse): string {
  if (review.final_decision === "auto_route") return "approve";
  if (review.final_decision === "manual_review") return "edit";
  return "reject";
}
