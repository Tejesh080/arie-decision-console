import {
  AWAITING_REVIEW_STATUSES,
  FAILURE_STATUSES,
  QUALIFIED_STATUSES,
  REJECTED_STATUSES,
  SHADOW_STATUSES,
  type LeadStatus,
} from "@/lib/api/types";
import type { BadgeTone } from "@/components/ui/Badge";

const DECISION_LABELS: Record<string, string> = {
  auto_route: "Auto-route",
  escalate_human: "Escalate to human",
  reject: "Reject",
};

export function decisionLabel(decision: string): string {
  return DECISION_LABELS[decision] ?? decision;
}

const REVIEW_ACTION_LABELS: Record<string, string> = {
  approve: "Approved",
  reject: "Rejected",
  edit: "Edited (manual review)",
};

export function reviewActionLabel(action: string | null): string {
  if (!action) return "—";
  return REVIEW_ACTION_LABELS[action] ?? action;
}

const EMPTY_NOTE_PLACEHOLDERS = new Set(["na", "n/a"]);

/** Reviewers sometimes type a literal "NA" / "N/A" placeholder instead of
 * leaving the field blank — treat that the same as no note so the UI never
 * quotes a non-answer as if it were real reviewer input. */
export function reviewerNote(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const trimmed = notes.trim();
  if (trimmed.length === 0) return null;
  if (EMPTY_NOTE_PLACEHOLDERS.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

/** Which of the app's four semantic roles a lead status belongs to, for
 * consistent badge coloring — mirrors `arie.statemachine.transitions`'s own
 * QUALIFIED/REJECTED/AWAITING_REVIEW/FAILURE groups exactly. */
export function toneForStatus(status: LeadStatus): BadgeTone {
  if (SHADOW_STATUSES.includes(status)) return "shadow";
  if (QUALIFIED_STATUSES.includes(status)) return "qualify";
  if (REJECTED_STATUSES.includes(status)) return "reject";
  if (AWAITING_REVIEW_STATUSES.includes(status)) return "human";
  if (FAILURE_STATUSES.includes(status)) return "reject";
  return "pending";
}
