import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { OnboardingChecklist } from "./OnboardingChecklist";
import type { BillingResponse, OnboardingStatusResponse } from "@/lib/api/types";

const { getOnboardingStatusMock } = vi.hoisted(() => ({
  getOnboardingStatusMock: vi.fn(),
}));
vi.mock("@/lib/api/onboarding", () => ({ getOnboardingStatus: getOnboardingStatusMock }));

// Kept out of every existing test's assertions by default (rejected — the
// row simply doesn't render, matching this component's own "best-effort"
// billing fetch) so the pre-existing STEPS-only assertions below stay
// stable; a dedicated test at the bottom exercises the row itself.
const { getBillingMock } = vi.hoisted(() => ({ getBillingMock: vi.fn() }));
vi.mock("@/lib/api/billing", () => ({ getBilling: getBillingMock }));

function makeStatus(overrides: Partial<OnboardingStatusResponse> = {}): OnboardingStatusResponse {
  return {
    account_created: true,
    organization_configured: true,
    icp_configured: false,
    provider_configured: false,
    first_upload_completed: false,
    first_batch_processed: false,
    completed: false,
    completed_at: null,
    ...overrides,
  };
}

function makeBilling(overrides: Partial<BillingResponse["entitlements"]> = {}): BillingResponse {
  const now = "2026-01-01T00:00:00Z";
  return {
    billing: {
      organization_id: "org-1",
      stripe_customer_id: null,
      stripe_subscription_id: null,
      plan: "starter",
      status: "none",
      current_period_start: null,
      current_period_end: null,
      cancel_at_period_end: false,
      canceled_at: null,
      created_at: now,
      updated_at: now,
    },
    entitlements: {
      plan: "unsubscribed",
      max_leads_per_month: 25,
      max_csv_rows_per_upload: 10,
      max_modeled_spend_usd_per_month: 1,
      max_members: 1,
      live_provider_feature_allowed: false,
      ...overrides,
    },
  };
}

describe("OnboardingChecklist", () => {
  beforeEach(() => {
    getOnboardingStatusMock.mockReset();
    getBillingMock.mockReset();
    getBillingMock.mockRejectedValue(new Error("not exercised in this test"));
  });

  it("renders each step's done/not-done state from the backend response", async () => {
    // Done: organization (default true), icp, first_upload. Not done:
    // providers, first_batch_processed — five steps total.
    getOnboardingStatusMock.mockResolvedValue(
      makeStatus({ icp_configured: true, first_upload_completed: true }),
    );
    render(<OnboardingChecklist />);
    await waitFor(() => expect(screen.getByText("ICP")).toBeInTheDocument());

    expect(screen.getAllByText("View")).toHaveLength(3);
    expect(screen.getAllByText("Set up")).toHaveLength(2);
  });

  it("links each step to its real page", async () => {
    getOnboardingStatusMock.mockResolvedValue(makeStatus());
    render(<OnboardingChecklist />);
    await waitFor(() => expect(screen.getByText("Organization")).toBeInTheDocument());

    const links = screen.getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).toEqual(expect.arrayContaining(["/settings", "/icp", "/providers", "/batches"]));
  });

  it("marks providers as optional while simulated and excludes it from the required set", async () => {
    getOnboardingStatusMock.mockResolvedValue(makeStatus());
    render(<OnboardingChecklist />);
    await waitFor(() => expect(screen.getByText("Providers")).toBeInTheDocument());
    expect(screen.getByText(/optional while simulated/i)).toBeInTheDocument();
  });

  it("shows the completion banner only once completed is true", async () => {
    getOnboardingStatusMock.mockResolvedValue(
      makeStatus({
        icp_configured: true,
        first_upload_completed: true,
        first_batch_processed: true,
        completed: true,
        completed_at: "2026-01-05T00:00:00Z",
      }),
    );
    render(<OnboardingChecklist />);
    await waitFor(() => expect(screen.getByText(/onboarding complete/i)).toBeInTheDocument());
  });

  it("does not show the completion banner while incomplete", async () => {
    getOnboardingStatusMock.mockResolvedValue(makeStatus());
    render(<OnboardingChecklist />);
    await waitFor(() => expect(screen.getByText("Organization")).toBeInTheDocument());
    expect(screen.queryByText(/onboarding complete/i)).not.toBeInTheDocument();
  });

  it("surfaces a load error", async () => {
    getOnboardingStatusMock.mockRejectedValue(new Error("backend unreachable"));
    render(<OnboardingChecklist />);
    await waitFor(() => expect(screen.getByText("backend unreachable")).toBeInTheDocument());
  });

  it("prompts to choose a plan while unsubscribed", async () => {
    getOnboardingStatusMock.mockResolvedValue(makeStatus());
    getBillingMock.mockResolvedValue(makeBilling({ plan: "unsubscribed" }));
    render(<OnboardingChecklist />);
    await waitFor(() => expect(screen.getByText("Plan & billing")).toBeInTheDocument());
    expect(screen.getByText("Choose a plan")).toBeInTheDocument();
    expect(screen.getByText(/no active subscription/i)).toBeInTheDocument();
  });

  it("shows the active plan once subscribed", async () => {
    getOnboardingStatusMock.mockResolvedValue(makeStatus());
    getBillingMock.mockResolvedValue(makeBilling({ plan: "growth" }));
    render(<OnboardingChecklist />);
    await waitFor(() => expect(screen.getByText("Plan & billing")).toBeInTheDocument());
    expect(screen.getByText(/on the growth plan/i)).toBeInTheDocument();
  });
});
