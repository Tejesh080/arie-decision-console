import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import UsagePage from "./page";
import type { UsageAgainstLimitsResponse, UsageSummary } from "@/lib/api/types";

const { getUsageMock } = vi.hoisted(() => ({ getUsageMock: vi.fn() }));
vi.mock("@/lib/api/usage", () => ({ getUsage: getUsageMock }));

const { getUsageAgainstLimitsMock } = vi.hoisted(() => ({ getUsageAgainstLimitsMock: vi.fn() }));
vi.mock("@/lib/api/limits", () => ({ getUsageAgainstLimits: getUsageAgainstLimitsMock }));

function makeUsage(overrides: Partial<UsageSummary> = {}): UsageSummary {
  return {
    from_at: "2026-01-01T00:00:00Z",
    to_at: "2026-01-31T00:00:00Z",
    leads_processed: 10,
    qualified_count: 6,
    rejected_count: 2,
    review_count: 1,
    pending_count: 1,
    failed_count: 0,
    provider_calls: 20,
    cache_hits: 3,
    provider_cost_usd: 1.5,
    model_cost_usd: 0.1,
    total_cost_usd: 1.6,
    ...overrides,
  };
}

function makeLimits(
  overrides: Partial<UsageAgainstLimitsResponse> = {},
): UsageAgainstLimitsResponse {
  return {
    leads_used: 10,
    leads_limit: 5000,
    leads_remaining: 4990,
    modeled_spend_used_usd: 1.6,
    modeled_spend_limit_usd: 50,
    modeled_spend_remaining_usd: 48.4,
    max_csv_rows_per_upload: 200,
    period_start: "2026-01-01T00:00:00Z",
    period_end: "2026-02-01T00:00:00Z",
    ...overrides,
  };
}

describe("UsagePage — limits panel", () => {
  beforeEach(() => {
    getUsageMock.mockReset();
    getUsageAgainstLimitsMock.mockReset();
  });

  it("shows leads used/remaining and modeled spend against configured limits", async () => {
    getUsageMock.mockResolvedValue(makeUsage());
    getUsageAgainstLimitsMock.mockResolvedValue(makeLimits());

    render(<UsagePage />);
    await waitFor(() => expect(screen.getByText("Monthly limits")).toBeInTheDocument());

    expect(screen.getByText("4990")).toBeInTheDocument();
    expect(screen.getByText("$1.60")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.queryByText(/reached its monthly quota/i)).not.toBeInTheDocument();
  });

  it("shows a clear explanation once the lead quota is reached", async () => {
    getUsageMock.mockResolvedValue(makeUsage({ leads_processed: 5000 }));
    getUsageAgainstLimitsMock.mockResolvedValue(
      makeLimits({ leads_used: 5000, leads_remaining: 0 }),
    );

    render(<UsagePage />);
    await waitFor(() => expect(screen.getByText(/reached its monthly quota/i)).toBeInTheDocument());
  });

  it("never labels modeled spend as billed vendor spend", async () => {
    getUsageMock.mockResolvedValue(makeUsage());
    getUsageAgainstLimitsMock.mockResolvedValue(makeLimits());

    render(<UsagePage />);
    await waitFor(() => expect(screen.getByText("Monthly limits")).toBeInTheDocument());
    expect(screen.getByText(/modeled spend is not billed vendor spend/i)).toBeInTheDocument();
  });

  it("surfaces a limits load error independently of the usage panel", async () => {
    getUsageMock.mockResolvedValue(makeUsage());
    getUsageAgainstLimitsMock.mockRejectedValue(new Error("limits unavailable"));

    render(<UsagePage />);
    await waitFor(() => expect(screen.getByText("limits unavailable")).toBeInTheDocument());
    // The usage panels above still rendered from the successful call.
    expect(screen.getByText("Leads processed")).toBeInTheDocument();
  });
});
