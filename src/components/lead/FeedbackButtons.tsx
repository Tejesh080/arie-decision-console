"use client";

import { useEffect, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import clsx from "clsx";
import { getLeadFeedback, submitLeadFeedback } from "@/lib/api/leads";
import type { FeedbackReason, FeedbackResponse, FeedbackSentiment } from "@/lib/api/types";
import { Button } from "@/components/ui/Button";

const REASON_OPTIONS: { value: FeedbackReason; label: string }[] = [
  { value: "wrong_industry", label: "Wrong industry" },
  { value: "wrong_person", label: "Wrong person" },
  { value: "company_too_small", label: "Company too small" },
  { value: "company_too_large", label: "Company too large" },
  { value: "not_decision_maker", label: "Not a decision-maker" },
  { value: "already_customer", label: "Already a customer" },
  { value: "not_interested", label: "Not interested" },
  { value: "other", label: "Other" },
];

/**
 * "Was this recommendation useful?" — M7 Slice 4 Part N.
 *
 * An observation ARIE records, never a mutation: submitting feedback here
 * changes no score, no profile, no lead status — see
 * `arie.feedback`'s own module docstring. Thumbs-down opens a small,
 * optional reason picker; nothing here is a survey.
 */
export function FeedbackButtons({ leadId }: { leadId: string }) {
  const [existing, setExisting] = useState<FeedbackResponse | null | "loading">("loading");
  const [pickingReason, setPickingReason] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getLeadFeedback(leadId)
      .then((result) => {
        if (!cancelled) setExisting(result);
      })
      .catch(() => {
        if (!cancelled) setExisting(null);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  async function submit(sentiment: FeedbackSentiment, reason?: FeedbackReason) {
    setSaving(true);
    setError(null);
    try {
      const result = await submitLeadFeedback(leadId, { sentiment, reason });
      setExisting(result);
      setPickingReason(false);
    } catch {
      setError("Couldn't save your feedback — try again.");
    } finally {
      setSaving(false);
    }
  }

  if (existing === "loading") return null;

  return (
    <div className="flex flex-col gap-2.5">
      <p className="t-label text-text-faint">Was this recommendation useful?</p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={saving}
          aria-pressed={existing?.sentiment === "positive"}
          className={clsx(existing?.sentiment === "positive" && "border-qualify-edge text-qualify")}
          onClick={() => submit("positive", "good_match")}
        >
          <ThumbsUp className="h-3.5 w-3.5" strokeWidth={2.25} />
          Useful
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={saving}
          aria-pressed={existing?.sentiment === "negative"}
          className={clsx(existing?.sentiment === "negative" && "border-reject-edge text-reject")}
          onClick={() => setPickingReason((open) => !open)}
        >
          <ThumbsDown className="h-3.5 w-3.5" strokeWidth={2.25} />
          Not useful
        </Button>
        {existing && !pickingReason && (
          <span className="text-xs text-text-faint">Feedback saved.</span>
        )}
      </div>

      {pickingReason && (
        <div className="surface-flat flex flex-col gap-2 p-3">
          <p className="text-xs text-text-dim">What was wrong? (optional)</p>
          <div className="flex flex-wrap gap-1.5">
            {REASON_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={saving}
                className="rounded-full border border-border-strong bg-surface-2 px-2.5 py-1 text-xs text-text-dim transition-colors hover:border-border-loud hover:text-text disabled:pointer-events-none disabled:opacity-50"
                onClick={() => submit("negative", option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={saving}
            className="self-start text-xs text-text-faint hover:text-text-dim"
            onClick={() => submit("negative")}
          >
            Skip and just say not useful
          </button>
        </div>
      )}

      {error && <p className="text-xs text-reject">{error}</p>}
    </div>
  );
}
