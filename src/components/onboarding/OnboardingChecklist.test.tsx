import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { OnboardingChecklist } from "./OnboardingChecklist";
import type { OnboardingStatusResponse } from "@/lib/api/types";

const { getOnboardingStatusMock } = vi.hoisted(() => ({
  getOnboardingStatusMock: vi.fn(),
}));
vi.mock("@/lib/api/onboarding", () => ({ getOnboardingStatus: getOnboardingStatusMock }));

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

describe("OnboardingChecklist", () => {
  beforeEach(() => {
    getOnboardingStatusMock.mockReset();
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
    expect(hrefs).toEqual(
      expect.arrayContaining(["/settings", "/icp", "/providers", "/batches"]),
    );
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
});
