import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AskArieAboutLead } from "./AskArieAboutLead";
import type { LeadCopilotResponse } from "@/lib/api/types";

const { askLeadCopilotMock } = vi.hoisted(() => ({ askLeadCopilotMock: vi.fn() }));
vi.mock("@/lib/api/copilot", () => ({ askLeadCopilot: askLeadCopilotMock }));

function makeResponse(overrides: Partial<LeadCopilotResponse> = {}): LeadCopilotResponse {
  return {
    lead_id: "lead-1",
    intent: "lead_explanation",
    answer: "Strong match based on company size and contact seniority.",
    missing_information: [],
    researchable_field: null,
    ...overrides,
  };
}

beforeEach(() => {
  askLeadCopilotMock.mockReset();
});

describe("AskArieAboutLead", () => {
  it("is collapsed until the user opens it", () => {
    render(<AskArieAboutLead leadId="lead-1" />);
    expect(screen.getByRole("button", { name: /ask arie about this lead/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/why is this a good lead/i)).not.toBeInTheDocument();
  });

  it("opens and shows suggested questions", async () => {
    const user = userEvent.setup();
    render(<AskArieAboutLead leadId="lead-1" />);

    await user.click(screen.getByRole("button", { name: /ask arie about this lead/i }));

    expect(screen.getByText("Would more research help?")).toBeInTheDocument();
    expect(screen.getByText("What information is missing?")).toBeInTheDocument();
  });

  it("submits a suggested question and renders the answer", async () => {
    askLeadCopilotMock.mockResolvedValue(makeResponse());
    const user = userEvent.setup();
    render(<AskArieAboutLead leadId="lead-1" />);

    await user.click(screen.getByRole("button", { name: /ask arie about this lead/i }));
    await user.click(screen.getByText("Why is this a good lead?"));

    await waitFor(() =>
      expect(askLeadCopilotMock).toHaveBeenCalledWith("lead-1", "Why is this a good lead?"),
    );
    expect(
      await screen.findByText("Strong match based on company size and contact seniority."),
    ).toBeInTheDocument();
  });

  it("researchability answer never triggers research itself", async () => {
    askLeadCopilotMock.mockResolvedValue(
      makeResponse({
        intent: "lead_researchability",
        answer: "Yes. Company size is unknown and could materially change this recommendation.",
        researchable_field: "employee_count",
      }),
    );
    const user = userEvent.setup();
    render(<AskArieAboutLead leadId="lead-1" />);

    await user.click(screen.getByRole("button", { name: /ask arie about this lead/i }));
    await user.click(screen.getByText("Would more research help?"));

    expect(
      await screen.findByText(/company size is unknown and could materially change/i),
    ).toBeInTheDocument();
    // No "Research this" / execute-research affordance is rendered by this
    // component — the answer is informational only (Part Y).
    expect(screen.queryByRole("button", { name: /research this/i })).not.toBeInTheDocument();
  });

  it("shows a retryable error without exposing a raw backend message", async () => {
    askLeadCopilotMock.mockRejectedValueOnce(new Error("500 Internal Server Error: traceback..."));
    const user = userEvent.setup();
    render(<AskArieAboutLead leadId="lead-1" />);

    await user.click(screen.getByRole("button", { name: /ask arie about this lead/i }));
    await user.click(screen.getByText("What information is missing?"));

    const errorMessage = await screen.findByText(/couldn't reach arie/i);
    expect(errorMessage.textContent).not.toContain("traceback");
  });
});
