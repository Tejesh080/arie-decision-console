import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecommendationPanel } from "./RecommendationPanel";
import type { LeadRecommendationResponse } from "@/lib/api/types";

vi.mock("@/lib/api/leads", () => ({
  getExplanation: vi.fn(),
}));
vi.mock("@/components/lead/AskArieAboutLead", () => ({
  AskArieAboutLead: () => null,
}));
vi.mock("@/components/lead/FeedbackButtons", () => ({
  FeedbackButtons: () => null,
}));
vi.mock("@/components/lead/ResearchOption", () => ({
  ResearchOption: () => null,
}));

function makeRecommendation(
  overrides: Partial<LeadRecommendationResponse> = {},
): LeadRecommendationResponse {
  return {
    lead_id: "lead-1",
    priority: "worth_pursuing",
    next_action: "email_first",
    machine_decision: "escalate_human",
    score: 60,
    confidence: 0.6,
    confidence_band: "medium",
    short_reason: "Possible match based on company size.",
    key_evidence: ["company size"],
    missing_information: ["contact seniority"],
    research_status: "researched",
    explanation_status: "not_requested",
    profile_version: 1,
    shadow: false,
    execution_mode: "simulated",
    evidence_sufficiency: "settled",
    ...overrides,
  };
}

describe("RecommendationPanel", () => {
  // Priority 3 hardening sprint (2026-09-21) -- the exact real case this was
  // built for: a REJECT recommendation whose evidence is still incomplete
  // must not read as "Skip", and the raw recommendation must stay visible.
  it("shows 'Needs more evidence', not 'Skip', for a REJECT with insufficient evidence", () => {
    render(
      <RecommendationPanel
        leadId="lead-1"
        recommendation={makeRecommendation({
          priority: "review",
          machine_decision: "reject",
          score: 20,
          confidence: 0.457,
          confidence_band: "low",
          evidence_sufficiency: "insufficient_evidence",
          short_reason:
            "ARIE's evidence on this lead is incomplete -- the outcome could still change " +
            "with more information, even though the current recommendation is reject.",
        })}
      />,
    );

    expect(screen.getByText("Needs more evidence")).toBeInTheDocument();
    expect(screen.queryByText("Skip")).not.toBeInTheDocument();
    expect(screen.getByText(/evidence on this lead is incomplete/)).toBeInTheDocument();
  });

  it("still shows plain 'Review' for an open human review, not 'Needs more evidence'", () => {
    render(
      <RecommendationPanel
        leadId="lead-1"
        recommendation={makeRecommendation({
          priority: "review",
          machine_decision: "escalate_human",
          evidence_sufficiency: "settled",
          short_reason: "This lead is waiting on a human review before it can move forward.",
        })}
      />,
    );

    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.queryByText("Needs more evidence")).not.toBeInTheDocument();
  });

  it("shows plain 'Skip' for a settled reject", () => {
    render(
      <RecommendationPanel
        leadId="lead-1"
        recommendation={makeRecommendation({
          priority: "skip",
          machine_decision: "reject",
          evidence_sufficiency: "settled",
          short_reason: "This lead falls outside your targeting profile.",
        })}
      />,
    );

    expect(screen.getByText("Skip")).toBeInTheDocument();
    expect(screen.queryByText("Needs more evidence")).not.toBeInTheDocument();
  });
});
