import type { ConfidenceBand, CustomerPriority, NextAction, ResearchStatus } from "@/lib/api/types";
import type { BadgeTone } from "@/components/ui/Badge";

/**
 * M7 Slice 4 — the customer-facing vocabulary. Mirrors
 * `arie.recommendations`'s enums exactly; this file only supplies display
 * labels and badge tones, never re-derives the classification itself.
 */

const PRIORITY_LABELS: Record<CustomerPriority, string> = {
  contact_first: "Contact first",
  worth_pursuing: "Worth pursuing",
  review: "Review",
  skip: "Skip",
};

export function priorityLabel(priority: CustomerPriority): string {
  return PRIORITY_LABELS[priority];
}

const PRIORITY_TONES: Record<CustomerPriority, BadgeTone> = {
  contact_first: "qualify",
  worth_pursuing: "machine",
  review: "human",
  skip: "reject",
};

export function priorityTone(priority: CustomerPriority): BadgeTone {
  return PRIORITY_TONES[priority];
}

const NEXT_ACTION_LABELS: Record<NextAction, string> = {
  contact_now: "Contact this person now",
  email_first: "Send an email first",
  find_decision_maker: "Find the decision-maker",
  research_more: "Research more",
  nurture: "Add to nurture",
  skip: "Skip",
  human_review: "Awaiting human review",
};

export function nextActionLabel(action: NextAction): string {
  return NEXT_ACTION_LABELS[action];
}

const CONFIDENCE_LABELS: Record<ConfidenceBand, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function confidenceBandLabel(band: ConfidenceBand): string {
  return CONFIDENCE_LABELS[band];
}

const RESEARCH_STATUS_LABELS: Record<ResearchStatus, string> = {
  not_needed: "Not needed",
  not_performed: "Not yet researched",
  researched: "Researched",
  partial: "Partially researched",
  unavailable: "Research unavailable",
};

export function researchStatusLabel(status: ResearchStatus): string {
  return RESEARCH_STATUS_LABELS[status];
}
