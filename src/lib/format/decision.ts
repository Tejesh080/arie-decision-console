import {
  AWAITING_REVIEW_STATUSES,
  FAILURE_STATUSES,
  QUALIFIED_STATUSES,
  REJECTED_STATUSES,
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

/** Which of the app's four semantic roles a lead status belongs to, for
 * consistent badge coloring — mirrors `arie.statemachine.transitions`'s own
 * QUALIFIED/REJECTED/AWAITING_REVIEW/FAILURE groups exactly. */
export function toneForStatus(status: LeadStatus): BadgeTone {
  if (QUALIFIED_STATUSES.includes(status)) return "qualify";
  if (REJECTED_STATUSES.includes(status)) return "reject";
  if (AWAITING_REVIEW_STATUSES.includes(status)) return "human";
  if (FAILURE_STATUSES.includes(status)) return "reject";
  return "pending";
}
