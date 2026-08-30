import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HumanReviewPanel } from "./HumanReviewPanel";
import { ArieConflictError } from "@/lib/api/errors";
import type { ReceiptResponse, ReviewResponse } from "@/lib/api/types";

const { submitReviewDecisionMock } = vi.hoisted(() => ({
  submitReviewDecisionMock: vi.fn(),
}));
vi.mock("@/lib/api/reviews", () => ({ submitReviewDecision: submitReviewDecisionMock }));

function makeReceipt(overrides: Partial<ReceiptResponse> = {}): ReceiptResponse {
  return {
    receipt_version: "1",
    lead_id: "lead-1",
    status: "decided",
    lead_status: "AWAITING_HUMAN",
    created_at: "2026-01-01T00:00:00Z",
    shadow: false,
    decision: {
      recommended_action: "reject",
      autonomous: false,
      final_status: "AWAITING_HUMAN",
      human_override: false,
    },
    score: {
      value: 51,
      threshold_qualify: 65,
      threshold_reject: 55,
      bounds: { lower: 49, upper: 53 },
      confidence: 0.42,
      tau: 0.8,
    },
    stopping: { reason_code: "all_providers_called", explanation: "Every provider was called." },
    versions: {
      policy: "calibrated_bounds",
      scorer: "icp-1.0.0",
      confidence_calibration: "platt",
      icp_profile_id: null,
      icp_profile_version: null,
    },
    cost: {
      provider_cost_usd: "1.00",
      model_cost_usd: "0",
      total_cost_usd: "1.00",
      budget_usd_cap: "1.50",
    },
    evidence: { cache_hits: 0, provider_calls: 8, items: [], unknown_fields: [] },
    providers: { called: [], not_called: [] },
    human_review: {
      review_id: "review-1",
      required: true,
      reviewer: null,
      original_decision: "reject",
      action: null,
      final_decision: null,
      responded_at: null,
    },
    ...overrides,
  };
}

function makePendingReview(overrides: Partial<ReviewResponse> = {}): ReviewResponse {
  return {
    review_id: "review-1",
    lead_id: "lead-1",
    requested_at: "2026-01-01T00:00:00Z",
    reviewer: null,
    original_decision: "reject",
    final_decision: null,
    notes: null,
    responded_at: null,
    is_pending: true,
    lead_status: "AWAITING_HUMAN",
    lead_version: 3,
    ...overrides,
  };
}

describe("HumanReviewPanel — pending review", () => {
  beforeEach(() => {
    submitReviewDecisionMock.mockReset();
  });

  it("shows the machine recommendation before any human action", () => {
    render(
      <HumanReviewPanel
        review={makePendingReview()}
        receipt={makeReceipt()}
        onDecided={vi.fn()}
        onConflict={vi.fn()}
      />,
    );
    expect(screen.getByText("Machine recommendation")).toBeInTheDocument();
    // "Reject" appears twice on purpose: the recommendation headline and the
    // reviewer's action button -- both are expected, so assert on the
    // specific role rather than a bare text match.
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
    expect(screen.getAllByText("Reject")).toHaveLength(2);
    expect(screen.getByText("Human review required")).toBeInTheDocument();
  });

  it("requires a two-step confirmation before submitting", async () => {
    const user = userEvent.setup();
    submitReviewDecisionMock.mockResolvedValue({ already_applied: false });
    const onDecided = vi.fn();

    render(
      <HumanReviewPanel
        review={makePendingReview()}
        receipt={makeReceipt()}
        onDecided={onDecided}
        onConflict={vi.fn()}
      />,
    );

    // A reviewer name is required — the field no longer defaults to the
    // machine source identifier.
    const submit = screen.getByRole("button", { name: "Submit decision" });
    expect(submit).toBeDisabled();
    await user.type(screen.getByPlaceholderText(/Your name/), "jane");

    await user.click(submit);
    expect(submitReviewDecisionMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Confirm approve" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirm approve" }));
    await waitFor(() => expect(submitReviewDecisionMock).toHaveBeenCalledTimes(1));
    expect(submitReviewDecisionMock).toHaveBeenCalledWith(
      "review-1",
      expect.objectContaining({ action: "approve", reviewer: "jane", expected_lead_version: 3 }),
    );
    await waitFor(() => expect(onDecided).toHaveBeenCalled());
  });

  it("requires non-empty notes before an edit can be submitted", async () => {
    const user = userEvent.setup();
    render(
      <HumanReviewPanel
        review={makePendingReview()}
        receipt={makeReceipt()}
        onDecided={vi.fn()}
        onConflict={vi.fn()}
      />,
    );

    await user.type(screen.getByPlaceholderText(/Your name/), "jane");
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const submit = screen.getByRole("button", { name: "Submit decision" });
    expect(submit).toBeDisabled();

    await user.type(screen.getByPlaceholderText(/Explain the override/), "Title was misread");
    expect(submit).toBeEnabled();
  });

  it("surfaces a conflict without a scary generic failure", async () => {
    const user = userEvent.setup();
    submitReviewDecisionMock.mockRejectedValue(
      new ArieConflictError("review already decided differently"),
    );
    const onConflict = vi.fn();

    render(
      <HumanReviewPanel
        review={makePendingReview()}
        receipt={makeReceipt()}
        onDecided={vi.fn()}
        onConflict={onConflict}
      />,
    );

    await user.type(screen.getByPlaceholderText(/Your name/), "jane");
    await user.click(screen.getByRole("button", { name: "Submit decision" }));
    await user.click(screen.getByRole("button", { name: "Confirm approve" }));

    await waitFor(() => expect(onConflict).toHaveBeenCalledTimes(1));
    expect(onConflict.mock.calls[0][0]).toMatch(/changed since you loaded it/);
  });
});

describe("HumanReviewPanel — resolved review", () => {
  it("preserves the machine -> human -> final sequence, never collapsing it", () => {
    render(
      <HumanReviewPanel
        review={makePendingReview({
          is_pending: false,
          reviewer: "jane",
          final_decision: "auto_route",
          responded_at: "2026-01-01T01:00:00Z",
        })}
        receipt={makeReceipt({
          lead_status: "AUTO_ROUTED",
          decision: {
            recommended_action: "reject",
            autonomous: false,
            final_status: "AUTO_ROUTED",
            human_override: true,
          },
        })}
        onDecided={vi.fn()}
        onConflict={vi.fn()}
      />,
    );

    expect(screen.getByText("Machine recommendation")).toBeInTheDocument();
    expect(screen.getByText("Reject")).toBeInTheDocument();
    expect(screen.getByText("Human action — jane")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getByText("Final outcome")).toBeInTheDocument();
    expect(screen.getByText("Auto-routed")).toBeInTheDocument();
    expect(screen.getByText(/Human override/)).toBeInTheDocument();
  });

  it("never claims a human override when the final decision matches the original", () => {
    render(
      <HumanReviewPanel
        review={makePendingReview({
          is_pending: false,
          reviewer: "jane",
          final_decision: "reject",
          responded_at: "2026-01-01T01:00:00Z",
        })}
        receipt={makeReceipt({
          lead_status: "SYNCED",
          decision: {
            recommended_action: "reject",
            autonomous: false,
            final_status: "SYNCED",
            human_override: false,
          },
        })}
        onDecided={vi.fn()}
        onConflict={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Human override/)).not.toBeInTheDocument();
  });

  it("escapes reviewer-supplied notes rather than rendering them as markup", () => {
    render(
      <HumanReviewPanel
        review={makePendingReview({
          is_pending: false,
          reviewer: "jane",
          final_decision: "manual_review",
          notes: '<img src=x onerror="alert(1)">',
          responded_at: "2026-01-01T01:00:00Z",
        })}
        receipt={makeReceipt({ lead_status: "MANUAL_REVIEW" })}
        onDecided={vi.fn()}
        onConflict={vi.fn()}
      />,
    );
    expect(document.querySelector("img")).not.toBeInTheDocument();
    expect(screen.getByText(/<img src=x onerror="alert\(1\)">/)).toBeInTheDocument();
  });

  it.each([null, "", "   ", "NA", "N/A", "n/a", " na "])(
    "shows 'No reviewer note' instead of quoting a meaningless note (%j)",
    (notes) => {
      render(
        <HumanReviewPanel
          review={makePendingReview({
            is_pending: false,
            reviewer: "jane",
            final_decision: "auto_route",
            notes,
            responded_at: "2026-01-01T01:00:00Z",
          })}
          receipt={makeReceipt({ lead_status: "AUTO_ROUTED" })}
          onDecided={vi.fn()}
          onConflict={vi.fn()}
        />,
      );
      expect(screen.getByText("No reviewer note")).toBeInTheDocument();
      expect(screen.queryByText(/[“"]/)).not.toBeInTheDocument();
    },
  );

  it("still quotes a real reviewer note", () => {
    render(
      <HumanReviewPanel
        review={makePendingReview({
          is_pending: false,
          reviewer: "jane",
          final_decision: "auto_route",
          notes: "Verified via LinkedIn, title matches.",
          responded_at: "2026-01-01T01:00:00Z",
        })}
        receipt={makeReceipt({ lead_status: "AUTO_ROUTED" })}
        onDecided={vi.fn()}
        onConflict={vi.fn()}
      />,
    );
    expect(screen.getByText(/Verified via LinkedIn, title matches\./)).toBeInTheDocument();
    expect(screen.queryByText("No reviewer note")).not.toBeInTheDocument();
  });
});
