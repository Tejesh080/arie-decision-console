import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { VerdictPanel } from "./VerdictPanel";
import type { ReceiptResponse } from "@/lib/api/types";

function makeReceipt(overrides: Partial<ReceiptResponse> = {}): ReceiptResponse {
  return {
    receipt_version: "1",
    lead_id: "lead-1",
    status: "decided",
    lead_status: "SYNCED",
    created_at: "2026-01-01T00:00:00Z",
    shadow: false,
    decision: {
      recommended_action: "reject",
      autonomous: true,
      final_status: "SYNCED",
      human_override: false,
      evidence_sufficiency: "settled",
    },
    score: {
      value: 20,
      threshold_qualify: 65,
      threshold_reject: 55,
      bounds: { lower: 0, upper: 100 },
      confidence: 0.457,
      tau: 0.8,
    },
    stopping: { reason_code: "confidence_reached", explanation: "Confidence was reached." },
    versions: {
      policy: "calibrated_bounds",
      scorer: "icp-1.0.0",
      confidence_calibration: "platt",
      icp_profile_id: null,
      icp_profile_version: null,
    },
    cost: {
      provider_cost_usd: "0.0065",
      model_cost_usd: "0",
      total_cost_usd: "0.0065",
      budget_usd_cap: "1.50",
    },
    evidence: { cache_hits: 0, provider_calls: 2, items: [], unknown_fields: [] },
    providers: { called: [], not_called: [] },
    human_review: null,
    ...overrides,
  };
}

describe("VerdictPanel", () => {
  // Priority 3 hardening sprint (2026-09-21) -- the real Steli Efti case
  // (score=20, bounds=[0,100], recommended_action="reject"): the raw
  // recommendation must still be visible, but flagged as provisional.
  it("flags an insufficient-evidence verdict without hiding the raw recommendation", () => {
    render(
      <VerdictPanel
        receipt={makeReceipt({
          decision: {
            recommended_action: "reject",
            autonomous: true,
            final_status: "SYNCED",
            human_override: false,
            evidence_sufficiency: "insufficient_evidence",
          },
        })}
      />,
    );

    expect(screen.getByText("Reject")).toBeInTheDocument();
    expect(screen.getByText("Insufficient evidence")).toBeInTheDocument();
    expect(screen.getByText(/reachable score range still crosses/)).toBeInTheDocument();
  });

  it("shows no caveat for a settled verdict", () => {
    render(<VerdictPanel receipt={makeReceipt()} />);

    expect(screen.getByText("Reject")).toBeInTheDocument();
    expect(screen.queryByText("Insufficient evidence")).not.toBeInTheDocument();
  });
});
