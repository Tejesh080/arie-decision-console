import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BatchInsightsPanel } from "./BatchInsightsPanel";
import type { BatchInsights } from "@/lib/api/types";

const { getBatchSummaryMock, exportBatchCsvTextMock } = vi.hoisted(() => ({
  getBatchSummaryMock: vi.fn(),
  exportBatchCsvTextMock: vi.fn(),
}));
vi.mock("@/lib/api/batches", () => ({
  getBatchSummary: getBatchSummaryMock,
  exportBatchCsvText: exportBatchCsvTextMock,
}));

function makeInsights(overrides: Partial<BatchInsights> = {}): BatchInsights {
  return {
    total_leads: 200,
    priority_counts: { contact_first: 18, worth_pursuing: 51, review: 42, skip: 89 },
    decided_leads: 200,
    unknown_scoring_observations: 184,
    expected_scoring_observations: 1200,
    unknown_data_rate: 0.1533,
    human_review_count: 42,
    human_review_rate: 0.21,
    provider_calls: 37,
    leads_with_provider_activity: 27,
    modeled_provider_cost_usd: "4.8100",
    actual_provider_cost_usd: "0.0000",
    actual_provider_cost_known_calls: 0,
    llm_calls: 3,
    modeled_llm_cost_usd: "0.0200",
    feedback_total: 12,
    feedback_positive: 9,
    feedback_approval_rate: 0.75,
    ...overrides,
  };
}

beforeEach(() => {
  getBatchSummaryMock.mockReset();
  exportBatchCsvTextMock.mockReset();
  // jsdom has no real Blob/URL download machinery — stub just enough for
  // the component's download flow to run without throwing.
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
});

describe("BatchInsightsPanel", () => {
  it("renders priority counts", () => {
    render(<BatchInsightsPanel batchId="batch-1" insights={makeInsights()} />);
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("51")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("89")).toBeInTheDocument();
  });

  it("renders the unknown-data rate as a percentage", () => {
    render(<BatchInsightsPanel batchId="batch-1" insights={makeInsights()} />);
    expect(screen.getByText("15.3%")).toBeInTheDocument();
  });

  it("shows actual cost as unavailable when no provider reported one", () => {
    render(<BatchInsightsPanel batchId="batch-1" insights={makeInsights()} />);
    expect(screen.getByText(/actual billed provider cost unavailable/i)).toBeInTheDocument();
  });

  it("shows the actual cost figure once at least one provider reported it", () => {
    render(
      <BatchInsightsPanel
        batchId="batch-1"
        insights={makeInsights({
          actual_provider_cost_known_calls: 5,
          actual_provider_cost_usd: "3.10",
        })}
      />,
    );
    expect(screen.getByText(/actual billed provider cost: \$3\.1000/i)).toBeInTheDocument();
  });

  it("generates a summary on request, not automatically", async () => {
    getBatchSummaryMock.mockResolvedValue({
      summary: "18 leads worth immediate attention.",
      source: "ai",
    });
    const user = userEvent.setup();
    render(<BatchInsightsPanel batchId="batch-1" insights={makeInsights()} />);

    expect(getBatchSummaryMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /generate a summary/i }));

    expect(await screen.findByText("18 leads worth immediate attention.")).toBeInTheDocument();
  });

  it("labels a deterministic-fallback summary as such", async () => {
    getBatchSummaryMock.mockResolvedValue({
      summary: "200 leads: 18 Contact First.",
      source: "deterministic",
    });
    const user = userEvent.setup();
    render(<BatchInsightsPanel batchId="batch-1" insights={makeInsights()} />);

    await user.click(screen.getByRole("button", { name: /generate a summary/i }));

    expect(await screen.findByText(/deterministic summary/i)).toBeInTheDocument();
  });

  it("exports a CSV via a client-side download, not a raw link", async () => {
    exportBatchCsvTextMock.mockResolvedValue("company,contact\nAcme,Nadia\n");
    const user = userEvent.setup();
    render(<BatchInsightsPanel batchId="batch-1" insights={makeInsights()} />);

    await user.click(screen.getByRole("button", { name: /export csv/i }));

    await waitFor(() => expect(exportBatchCsvTextMock).toHaveBeenCalledWith("batch-1"));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
  });

  it("shows a retryable error if export fails", async () => {
    exportBatchCsvTextMock.mockRejectedValue(new Error("network"));
    const user = userEvent.setup();
    render(<BatchInsightsPanel batchId="batch-1" insights={makeInsights()} />);

    await user.click(screen.getByRole("button", { name: /export csv/i }));

    expect(await screen.findByText(/couldn't export/i)).toBeInTheDocument();
  });
});
