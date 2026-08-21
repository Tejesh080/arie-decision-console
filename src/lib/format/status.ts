import type { LeadStatus } from "@/lib/api/types";

/**
 * Every label here maps directly to one real `LeadStatus` value from the
 * backend — none are invented progress events. See
 * `arie.core.types.LeadStatus` / `arie.statemachine.transitions` for the
 * source of truth.
 */
export const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "Received",
  IDENTITY_RESOLVED: "Identity resolved",
  SCORING: "Scoring",
  FETCHING_EVIDENCE: "Collecting evidence",
  INTEGRATING: "Integrating evidence",
  DECISION: "Finalizing decision",
  // Deliberately not "decided autonomously" — AUTO_ROUTED is also the
  // status a human-approved escalation lands on
  // (HUMAN_REVIEW_OUTCOMES["auto_route"]), so the status alone can't claim
  // *how* it got there. That claim belongs to `decision.autonomous` /
  // `decision.human_override`, rendered separately.
  AUTO_ROUTED: "Auto-routed",
  AWAITING_HUMAN: "Awaiting human review",
  MANUAL_REVIEW: "Manually reviewed",
  ROUTED: "Routed",
  SYNCED: "Rejected",
  FAILED: "Failed",
  DEAD_LETTER: "Failed — retries exhausted",
  SHADOW_EVALUATED: "Shadow evaluated",
};

export function statusLabel(status: LeadStatus): string {
  return STATUS_LABELS[status] ?? status;
}

/** Ordered stages shown in the New Lead flow's progress list — the subset
 * of statuses the queue actually auto-advances through before a branch. */
export const PROCESSING_SEQUENCE: LeadStatus[] = [
  "NEW",
  "SCORING",
  "FETCHING_EVIDENCE",
  "INTEGRATING",
  "DECISION",
];
