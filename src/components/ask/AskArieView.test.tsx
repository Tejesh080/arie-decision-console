import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AskArieView } from "./AskArieView";
import type { CopilotResponse } from "@/lib/api/types";

const { askCopilotMock } = vi.hoisted(() => ({ askCopilotMock: vi.fn() }));
vi.mock("@/lib/api/copilot", () => ({ askCopilot: askCopilotMock }));

function makeResponse(overrides: Partial<CopilotResponse> = {}): CopilotResponse {
  return {
    answer: "Start with these 2 leads.",
    leads: [
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
    intent: "work_today",
    result_count: 1,
    filters_applied: {},
    llm_used: false,
    ...overrides,
  };
}

beforeEach(() => {
  askCopilotMock.mockReset();
});

describe("AskArieView", () => {
  it("shows suggested prompts before any question is asked", () => {
    render(<AskArieView />);
    expect(screen.getByText("What should I work on today?")).toBeInTheDocument();
    expect(screen.getByText("Which leads need more research?")).toBeInTheDocument();
  });

  it("submits a suggested prompt directly", async () => {
    askCopilotMock.mockResolvedValue(makeResponse());
    const user = userEvent.setup();
    render(<AskArieView />);

    await user.click(screen.getByText("What should I work on today?"));

    await waitFor(() =>
      expect(askCopilotMock).toHaveBeenCalledWith("What should I work on today?"),
    );
    expect(await screen.findByText("Start with these 2 leads.")).toBeInTheDocument();
  });

  it("submits a typed question via the form", async () => {
    askCopilotMock.mockResolvedValue(makeResponse());
    const user = userEvent.setup();
    render(<AskArieView />);

    await user.type(
      screen.getByPlaceholderText("What should I work on today?"),
      "Show my best leads",
    );
    await user.click(screen.getByRole("button", { name: /ask/i }));

    await waitFor(() => expect(askCopilotMock).toHaveBeenCalledWith("Show my best leads"));
  });

  it("renders lead references that link to the lead detail page", async () => {
    askCopilotMock.mockResolvedValue(makeResponse());
    const user = userEvent.setup();
    render(<AskArieView />);

    await user.click(screen.getByText("Which leads need more research?"));

    const link = await screen.findByRole("link", { name: /acme corp/i });
    expect(link).toHaveAttribute("href", "/leads/lead-1");
  });

  it("renders an empty result with no lead cards", async () => {
    askCopilotMock.mockResolvedValue(
      makeResponse({
        answer: "No leads matched that question right now.",
        leads: [],
        result_count: 0,
      }),
    );
    const user = userEvent.setup();
    render(<AskArieView />);

    await user.click(screen.getByText("Which leads have low confidence?"));

    expect(
      await screen.findByText("No leads matched that question right now."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows the controlled unsupported-question answer without special handling", async () => {
    askCopilotMock.mockResolvedValue(
      makeResponse({
        answer:
          "Ask ARIE can help with your leads, targeting, and recommendations — try asking for " +
          "your top leads, leads needing research, or what to work on today.",
        leads: [],
        intent: "filter_leads",
        result_count: 0,
      }),
    );
    const user = userEvent.setup();
    render(<AskArieView />);

    await user.type(
      screen.getByPlaceholderText("What should I work on today?"),
      "What's the weather?",
    );
    await user.click(screen.getByRole("button", { name: /ask/i }));

    expect(await screen.findByText(/try asking for your top leads/i)).toBeInTheDocument();
  });

  it("shows a retryable error when the backend is unreachable", async () => {
    askCopilotMock.mockRejectedValueOnce(new Error("network"));
    askCopilotMock.mockResolvedValueOnce(makeResponse());
    const user = userEvent.setup();
    render(<AskArieView />);

    await user.click(screen.getByText("What should I work on today?"));
    expect(await screen.findByText(/couldn't reach arie/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /ask/i }));
    await waitFor(() => expect(askCopilotMock).toHaveBeenCalledTimes(2));
  });
});
