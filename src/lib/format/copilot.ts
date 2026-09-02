import type { CopilotIntent } from "@/lib/api/types";

/** M7 Slice 6 — display labels for `CopilotResponse.intent`/
 * `LeadCopilotResponse.intent`. Mirrors `arie.copilot.CopilotIntent` exactly;
 * this file only supplies presentation, never re-derives the classification. */
const INTENT_LABELS: Record<CopilotIntent, string> = {
  top_leads: "Top leads",
  filter_leads: "Matching leads",
  needs_research: "Needs research",
  missing_decision_maker: "Missing a decision-maker",
  low_confidence: "Low confidence",
  compare_leads: "Comparison",
  feedback_summary: "Feedback summary",
  work_today: "Today's priorities",
  lead_explanation: "Why this lead",
  lead_missing_info: "What's missing",
  lead_researchability: "Would research help?",
  lead_score_drivers: "What affects the score",
  lead_improvement_path: "Path to Contact First",
};

export function copilotIntentLabel(intent: CopilotIntent): string {
  return INTENT_LABELS[intent];
}

export const SUGGESTED_LIST_PROMPTS: readonly string[] = [
  "Show my best leads",
  "Which leads need more research?",
  "Which promising leads are missing decision makers?",
  "Which leads have low confidence?",
  "What should I work on today?",
];

export const SUGGESTED_LEAD_PROMPTS: readonly string[] = [
  "Why is this a good lead?",
  "What information is missing?",
  "Would more research help?",
  "What affects the score most?",
  "What would need to change for Contact First?",
];
