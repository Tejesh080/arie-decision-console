import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeedbackInsightsPanel } from "./FeedbackInsightsPanel";
import type { FeedbackInsights, RevisionProposal } from "@/lib/api/types";

const { getInsightsMock, analyzeMock, acceptMock, rejectMock } = vi.hoisted(() => ({
  getInsightsMock: vi.fn(),
  analyzeMock: vi.fn(),
  acceptMock: vi.fn(),
  rejectMock: vi.fn(),
}));
vi.mock("@/lib/api/feedbackInsights", () => ({
  getFeedbackInsights: getInsightsMock,
  analyzeFeedback: analyzeMock,
}));
vi.mock("@/lib/api/mapping", () => ({
  acceptProposal: acceptMock,
  rejectProposal: rejectMock,
}));

function makeInsights(overrides: Partial<FeedbackInsights> = {}): FeedbackInsights {
  return {
    total: 12,
    positive: 8,
    negative: 4,
    agreement_rate: 0.6667,
    support: "eligible",
    by_priority: {},
    by_profile_version: {},
    negative_reason_counts: { company_too_small: 3 },
    groups: [],
    proposal: null,
    ...overrides,
  };
}

function makeProposal(overrides: Partial<RevisionProposal> = {}): RevisionProposal {
  return {
    proposal_id: "prop-1",
    organization_id: "org-1",
    profile_id: "profile-1",
    profile_version: 3,
    source: "user_feedback",
    status: "proposed",
    summary:
      "Based on your feedback, very small companies are a recurring source of poor recommendations.",
    changes: [
      {
        kind: "employee_band",
        dimension: "employee_count",
        target: "employees_1_10",
        target_label: "companies with 1-10 people",
        from_value: "preferred",
        to_value: "acceptable",
        rationale: "In this data, they had a lower positive-outcome rate.",
      },
    ],
    observations: [],
    caveats: [],
    supporting_statistics: {},
    evidence_strength: "moderate",
    sample_size: 12,
    created_at: "2026-01-01T00:00:00Z",
    resolved_at: null,
    resulting_profile_id: null,
    ...overrides,
  };
}

beforeEach(() => {
  getInsightsMock.mockReset();
  analyzeMock.mockReset();
  acceptMock.mockReset();
  rejectMock.mockReset();
});

describe("FeedbackInsightsPanel", () => {
  it("renders nothing while there is no feedback at all", async () => {
    getInsightsMock.mockResolvedValue(
      makeInsights({ total: 0, positive: 0, negative: 0, support: "insufficient_data" }),
    );
    const { container } = render(<FeedbackInsightsPanel canEdit />);
    await waitFor(() => expect(getInsightsMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a summary once feedback exists", async () => {
    getInsightsMock.mockResolvedValue(makeInsights());
    render(<FeedbackInsightsPanel canEdit />);
    expect(await screen.findByText(/12 recommendations reviewed/i)).toBeInTheDocument();
  });

  it("shows an analyze button only when eligible and no proposal exists yet", async () => {
    getInsightsMock.mockResolvedValue(makeInsights({ support: "eligible", proposal: null }));
    render(<FeedbackInsightsPanel canEdit />);
    expect(await screen.findByRole("button", { name: /analyze feedback/i })).toBeInTheDocument();
  });

  it("does not show an analyze button below the eligible tier", async () => {
    getInsightsMock.mockResolvedValue(makeInsights({ support: "summary_only" }));
    render(<FeedbackInsightsPanel canEdit />);
    await screen.findByText(/reviewed/i);
    expect(screen.queryByRole("button", { name: /analyze feedback/i })).not.toBeInTheDocument();
  });

  it("clicking analyze surfaces a returned proposal", async () => {
    getInsightsMock.mockResolvedValue(makeInsights({ support: "eligible", proposal: null }));
    analyzeMock.mockResolvedValue(makeInsights({ support: "eligible", proposal: makeProposal() }));
    const user = userEvent.setup();
    render(<FeedbackInsightsPanel canEdit />);

    await user.click(await screen.findByRole("button", { name: /analyze feedback/i }));

    expect(
      await screen.findByText(/very small companies are a recurring source/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Based on your feedback")).toBeInTheDocument();
  });

  it("renders an existing proposal without requiring analyze to be clicked", async () => {
    getInsightsMock.mockResolvedValue(makeInsights({ proposal: makeProposal() }));
    render(<FeedbackInsightsPanel canEdit />);
    expect(
      await screen.findByText(/very small companies are a recurring source/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /analyze feedback/i })).not.toBeInTheDocument();
  });

  it("applying the proposal calls acceptProposal and notifies the parent", async () => {
    getInsightsMock.mockResolvedValue(makeInsights({ proposal: makeProposal() }));
    acceptMock.mockResolvedValue({ profile_id: "p2", version: 4 });
    const onProfileUpdated = vi.fn();
    const user = userEvent.setup();
    render(<FeedbackInsightsPanel canEdit onProfileUpdated={onProfileUpdated} />);

    await user.click(await screen.findByRole("button", { name: /apply this change/i }));

    await waitFor(() =>
      expect(acceptMock).toHaveBeenCalledWith("prop-1", "Applied from suggestion"),
    );
    await waitFor(() =>
      expect(onProfileUpdated).toHaveBeenCalledWith({ profile_id: "p2", version: 4 }),
    );
    expect(await screen.findByText(/applied as version 4/i)).toBeInTheDocument();
  });

  it("dismissing the proposal never applies anything", async () => {
    getInsightsMock.mockResolvedValue(makeInsights({ proposal: makeProposal() }));
    rejectMock.mockResolvedValue(makeProposal({ status: "rejected" }));
    const user = userEvent.setup();
    render(<FeedbackInsightsPanel canEdit />);

    await user.click(await screen.findByRole("button", { name: /not now/i }));

    await waitFor(() => expect(rejectMock).toHaveBeenCalledWith("prop-1"));
    expect(acceptMock).not.toHaveBeenCalled();
    expect(await screen.findByText(/dismissed/i)).toBeInTheDocument();
  });

  it("disables apply/dismiss when the caller cannot edit targeting", async () => {
    getInsightsMock.mockResolvedValue(makeInsights({ proposal: makeProposal() }));
    render(<FeedbackInsightsPanel canEdit={false} />);
    expect(await screen.findByRole("button", { name: /apply this change/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /not now/i })).toBeDisabled();
  });
});
