import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CustomerDashboard } from "./CustomerDashboard";
import type { DashboardSummary } from "@/lib/api/types";

const { getDashboardMock } = vi.hoisted(() => ({ getDashboardMock: vi.fn() }));
vi.mock("@/lib/api/dashboard", () => ({ getDashboard: getDashboardMock }));

function makeSummary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
  return {
    priority_counts: { contact_first: 3, worth_pursuing: 7, review: 2, skip: 15 },
    top_leads: [
      {
        lead_id: "lead-1",
        company: "Acme Corp",
        contact: "Nadia",
        priority: "contact_first",
        score: 88.5,
        why: "Strong match on company size and seniority.",
        next_action: "contact_now",
      },
    ],
    latest_batch: {
      batch_id: "batch-1",
      organization_id: "org-1",
      filename: "September Prospects.csv",
      total_rows: 200,
      accepted_rows: 198,
      rejected_rows: 2,
      created_by_user_id: "user-1",
      created_at: "2026-09-01T00:00:00Z",
      progress: {
        total_rows: 200,
        accepted_rows: 198,
        rejected_rows: 2,
        processing_count: 0,
        qualified_count: 60,
        rejected_lead_count: 89,
        review_count: 42,
        failed_count: 0,
        provider_cost_usd: 4.81,
        model_cost_usd: 0.02,
        total_cost_usd: 4.83,
        is_complete: true,
      },
    },
    open_proposals: [],
    feedback: {
      total: 0,
      positive: 0,
      negative: 0,
      agreement_rate: null,
      by_priority: {},
      negative_reason_counts: {},
    },
    ...overrides,
  };
}

beforeEach(() => {
  getDashboardMock.mockReset();
});

describe("CustomerDashboard", () => {
  it("renders priority counts", async () => {
    getDashboardMock.mockResolvedValue(makeSummary());
    render(<CustomerDashboard />);
    await waitFor(() => expect(getDashboardMock).toHaveBeenCalled());
    expect(await screen.findByText("3")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("renders top leads linking to the lead detail page", async () => {
    getDashboardMock.mockResolvedValue(makeSummary());
    render(<CustomerDashboard />);
    const link = await screen.findByRole("link", { name: /acme corp/i });
    expect(link).toHaveAttribute("href", "/leads/lead-1");
  });

  it("renders the recent batch card", async () => {
    getDashboardMock.mockResolvedValue(makeSummary());
    render(<CustomerDashboard />);
    expect(await screen.findByText("September Prospects.csv")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view batch/i })).toHaveAttribute(
      "href",
      "/batches/batch-1",
    );
  });

  it("shows the feedback-needed message when there is no signal yet", async () => {
    getDashboardMock.mockResolvedValue(makeSummary());
    render(<CustomerDashboard />);
    expect(await screen.findByText(/more feedback needed/i)).toBeInTheDocument();
  });

  it("shows a targeting-improvement card when a proposal is open", async () => {
    getDashboardMock.mockResolvedValue(
      makeSummary({
        open_proposals: [
          {
            proposal_id: "prop-1",
            organization_id: "org-1",
            profile_id: "profile-1",
            profile_version: 3,
            source: "user_feedback",
            status: "proposed",
            summary:
              "7 of your recent negative recommendations involved companies you considered too small.",
            changes: [],
            observations: [],
            caveats: [],
            supporting_statistics: {},
            evidence_strength: "moderate",
            sample_size: 12,
            created_at: "2026-09-01T00:00:00Z",
            resolved_at: null,
            resulting_profile_id: null,
          },
        ],
      }),
    );
    render(<CustomerDashboard />);
    expect(await screen.findByText(/considered too small/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /review suggestion/i })).toHaveAttribute(
      "href",
      "/targeting",
    );
  });

  it("renders the primary and secondary CTAs", async () => {
    getDashboardMock.mockResolvedValue(makeSummary());
    render(<CustomerDashboard />);
    expect(await screen.findByRole("link", { name: /upload leads/i })).toHaveAttribute(
      "href",
      "/leads/new",
    );
    expect(screen.getByRole("link", { name: /ask arie/i })).toHaveAttribute("href", "/ask");
  });

  it("shows an empty-organization message when nothing needs attention", async () => {
    getDashboardMock.mockResolvedValue(
      makeSummary({
        top_leads: [],
        latest_batch: null,
        priority_counts: { contact_first: 0, worth_pursuing: 0, review: 0, skip: 0 },
      }),
    );
    render(<CustomerDashboard />);
    expect(await screen.findByText(/nothing needs attention right now/i)).toBeInTheDocument();
  });

  it("renders nothing (not an error banner) when the dashboard fails to load", async () => {
    getDashboardMock.mockRejectedValue(new Error("network"));
    const { container } = render(<CustomerDashboard />);
    await waitFor(() => expect(getDashboardMock).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
