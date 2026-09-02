import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeedbackButtons } from "./FeedbackButtons";
import type { FeedbackResponse } from "@/lib/api/types";

const { getLeadFeedbackMock, submitLeadFeedbackMock } = vi.hoisted(() => ({
  getLeadFeedbackMock: vi.fn(),
  submitLeadFeedbackMock: vi.fn(),
}));
vi.mock("@/lib/api/leads", () => ({
  getLeadFeedback: getLeadFeedbackMock,
  submitLeadFeedback: submitLeadFeedbackMock,
}));

function makeFeedback(overrides: Partial<FeedbackResponse> = {}): FeedbackResponse {
  return {
    feedback_id: "fb-1",
    lead_id: "lead-1",
    profile_version: 1,
    recommendation_priority: "contact_first",
    recommendation_next_action: "contact_now",
    sentiment: "positive",
    reason: null,
    note: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  getLeadFeedbackMock.mockReset();
  submitLeadFeedbackMock.mockReset();
});

describe("FeedbackButtons", () => {
  it("submits a thumbs-up with no reason prompt", async () => {
    getLeadFeedbackMock.mockResolvedValue(null);
    submitLeadFeedbackMock.mockResolvedValue(makeFeedback());
    const user = userEvent.setup();

    render(<FeedbackButtons leadId="lead-1" />);
    await waitFor(() => expect(getLeadFeedbackMock).toHaveBeenCalledWith("lead-1"));

    await user.click(await screen.findByRole("button", { name: "Useful" }));

    await waitFor(() =>
      expect(submitLeadFeedbackMock).toHaveBeenCalledWith("lead-1", {
        sentiment: "positive",
        reason: "good_match",
      }),
    );
    expect(await screen.findByText("Feedback saved.")).toBeInTheDocument();
  });

  it("opens a reason picker on thumbs-down and submits the chosen reason", async () => {
    getLeadFeedbackMock.mockResolvedValue(null);
    submitLeadFeedbackMock.mockResolvedValue(
      makeFeedback({ sentiment: "negative", reason: "wrong_industry" }),
    );
    const user = userEvent.setup();

    render(<FeedbackButtons leadId="lead-1" />);
    await waitFor(() => expect(getLeadFeedbackMock).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: /not useful/i }));
    await user.click(await screen.findByRole("button", { name: "Wrong industry" }));

    await waitFor(() =>
      expect(submitLeadFeedbackMock).toHaveBeenCalledWith("lead-1", {
        sentiment: "negative",
        reason: "wrong_industry",
      }),
    );
  });

  it("does not force a reason — skipping still submits", async () => {
    getLeadFeedbackMock.mockResolvedValue(null);
    submitLeadFeedbackMock.mockResolvedValue(makeFeedback({ sentiment: "negative", reason: null }));
    const user = userEvent.setup();

    render(<FeedbackButtons leadId="lead-1" />);
    await waitFor(() => expect(getLeadFeedbackMock).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: /not useful/i }));
    await user.click(await screen.findByText("Skip and just say not useful"));

    await waitFor(() =>
      expect(submitLeadFeedbackMock).toHaveBeenCalledWith("lead-1", {
        sentiment: "negative",
        reason: undefined,
      }),
    );
  });

  it("restores previously saved feedback on load", async () => {
    getLeadFeedbackMock.mockResolvedValue(makeFeedback({ sentiment: "negative" }));

    render(<FeedbackButtons leadId="lead-1" />);

    const notUseful = await screen.findByRole("button", { name: /not useful/i });
    await waitFor(() => expect(notUseful).toHaveAttribute("aria-pressed", "true"));
  });

  it("shows an error and lets the user retry if saving fails", async () => {
    getLeadFeedbackMock.mockResolvedValue(null);
    submitLeadFeedbackMock.mockRejectedValueOnce(new Error("network"));
    submitLeadFeedbackMock.mockResolvedValueOnce(makeFeedback());
    const user = userEvent.setup();

    render(<FeedbackButtons leadId="lead-1" />);
    await waitFor(() => expect(getLeadFeedbackMock).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: "Useful" }));
    expect(await screen.findByText(/couldn't save your feedback/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Useful" }));
    await waitFor(() => expect(submitLeadFeedbackMock).toHaveBeenCalledTimes(2));
  });
});
