import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TargetingSetupView } from "./TargetingSetupView";
import { ArieApiError } from "@/lib/api/errors";
import type { BusinessProfileDraft, ICPProfile, TargetingDraftResponse } from "@/lib/api/types";

const { draftMock, confirmMock } = vi.hoisted(() => ({
  draftMock: vi.fn(),
  confirmMock: vi.fn(),
}));
vi.mock("@/lib/api/targeting", () => ({
  draftTargetingProfile: draftMock,
  confirmTargetingProfile: confirmMock,
}));

const PROFILE: BusinessProfileDraft = {
  offering_summary: "Wholesale sports supplements to gyms and retailers.",
  plain_english_summary:
    "You sell sports supplements wholesale. The best customers are multi-location gyms, " +
    "supplement retailers and distributors.",
  ideal_company_types: ["multi-location gym", "supplement distributor"],
  preferred_industries: ["retail"],
  acceptable_industries: ["hospitality"],
  employee_band_preferences: {
    employees_1_10: "avoid",
    employees_11_50: "preferred",
    employees_51_200: "preferred",
  },
  preferred_seniorities: ["c_level"],
  acceptable_seniorities: ["director"],
  preferred_functions: ["operations"],
  acceptable_functions: ["sales"],
  preferred_titles: ["Owner", "Purchasing Manager"],
  preferred_geographies: ["Australia"],
  preferred_company_characteristics: ["operates more than one location"],
  positive_indicators: ["multiple locations"],
  negative_indicators: ["solo personal trainer"],
  hard_disqualifiers: ["individual trainers with no premises"],
  research_worthy_unknowns: ["how many locations"],
  relative_preferences: {
    employee_count: "high",
    industry: "high",
    title_seniority: "critical",
    title_function: "high",
    buying_intent: "medium",
    recent_trigger_event: "low",
  },
};

const DRAFT: TargetingDraftResponse = {
  objective: "best_prospects",
  profile: PROFILE,
  scoring_config: {
    qualify_threshold: 65,
    reject_threshold: 55,
    employee_count_bands: [{ min_employees: 1, max_employees: 10, points: 0 }],
    industry_points: { retail: 18 },
    seniority_points: { c_level: 26 },
    function_points: { operations: 18 },
    buying_intent_weight: 11,
    trigger_event_weight: 9,
    target_geographies: ["Australia"],
    disqualifier_enabled: true,
  } as TargetingDraftResponse["scoring_config"],
  allocation: [
    { dimension: "title_seniority", label: "Contact seniority", points: 26, rank: 1 },
    { dimension: "employee_count", label: "Company size", points: 18, rank: 2 },
    { dimension: "industry", label: "Industry", points: 18, rank: 3 },
    { dimension: "title_function", label: "Contact's role", points: 18, rank: 4 },
    { dimension: "buying_intent", label: "Signs of buying intent", points: 11, rank: 5 },
    { dimension: "recent_trigger_event", label: "Recent trigger event", points: 9, rank: 6 },
  ],
  llm_provider: "fake",
  llm_model: "fake-llm",
  llm_cost_usd: "0.0021",
};

const CONFIRMED = {
  profile_id: "p-2",
  organization_id: "org-1",
  version: 2,
  name: "AI-generated targeting",
  config: DRAFT.scoring_config,
  scorer_version: "icp-1.0.0",
  status: "active",
  created_by_user_id: "u-1",
  created_at: "2026-09-02T00:00:00Z",
  activated_at: "2026-09-02T00:00:00Z",
  retired_at: null,
} as ICPProfile;

async function fillAndGenerate(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/what do you sell/i), "We wholesale supplements.");
  await user.type(screen.getByLabelText(/who are you trying to reach/i), "Multi-location gyms.");
  await user.click(screen.getByRole("button", { name: /generate targeting profile/i }));
}

describe("TargetingSetupView", () => {
  beforeEach(() => {
    draftMock.mockReset();
    confirmMock.mockReset();
  });

  it("renders the two questions and an objective, not a weight editor", () => {
    render(<TargetingSetupView canEdit />);
    expect(screen.getByLabelText(/what do you sell/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/who are you trying to reach/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/optimising for/i)).toBeInTheDocument();
    // The point weights are a consequence, never the first thing asked for.
    expect(screen.queryByText(/26 pts/)).not.toBeInTheDocument();
  });

  it("cannot generate until both questions are answered", async () => {
    const user = userEvent.setup();
    render(<TargetingSetupView canEdit />);
    const button = screen.getByRole("button", { name: /generate targeting profile/i });
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText(/what do you sell/i), "Supplements.");
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText(/who are you trying to reach/i), "Gyms.");
    expect(button).toBeEnabled();
  });

  it("sends exactly what the customer typed, plus the objective", async () => {
    draftMock.mockResolvedValue(DRAFT);
    const user = userEvent.setup();
    render(<TargetingSetupView canEdit />);
    await user.selectOptions(screen.getByLabelText(/optimising for/i), "high_value");
    await fillAndGenerate(user);
    await waitFor(() => expect(draftMock).toHaveBeenCalledTimes(1));
    expect(draftMock).toHaveBeenCalledWith({
      what_you_sell: "We wholesale supplements.",
      who_you_want: "Multi-location gyms.",
      objective: "high_value",
    });
  });

  it("shows a loading state while generating", async () => {
    let resolve: (value: TargetingDraftResponse) => void = () => {};
    draftMock.mockReturnValue(
      new Promise<TargetingDraftResponse>((r) => {
        resolve = r;
      }),
    );
    const user = userEvent.setup();
    render(<TargetingSetupView canEdit />);
    await fillAndGenerate(user);
    expect(await screen.findByText(/reading your description/i)).toBeInTheDocument();
    resolve(DRAFT);
    await waitFor(() => expect(screen.getByText(/ARIE understood/i)).toBeInTheDocument());
  });

  it("presents the interpretation in plain English, not raw model output", async () => {
    draftMock.mockResolvedValue(DRAFT);
    const user = userEvent.setup();
    render(<TargetingSetupView canEdit />);
    await fillAndGenerate(user);

    expect(await screen.findByText(/ARIE understood/i)).toBeInTheDocument();
    expect(screen.getByText(PROFILE.plain_english_summary)).toBeInTheDocument();
    expect(screen.getByText("Best companies")).toBeInTheDocument();
    expect(screen.getByText("Best contacts")).toBeInTheDocument();
    expect(screen.getByText("Lower priority or avoid")).toBeInTheDocument();
    // Canonical identifiers are humanised, never shown raw.
    expect(screen.getByText("C level")).toBeInTheDocument();
    expect(screen.queryByText("c_level")).not.toBeInTheDocument();
  });

  it("keeps the technical configuration behind Advanced details", async () => {
    draftMock.mockResolvedValue(DRAFT);
    const user = userEvent.setup();
    render(<TargetingSetupView canEdit />);
    await fillAndGenerate(user);
    await screen.findByText(/ARIE understood/i);

    expect(screen.queryByText(/qualify_threshold/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /advanced details/i }));
    expect(screen.getByText(/qualify_threshold/)).toBeInTheDocument();
    expect(screen.getByText(/not a billed figure/i)).toBeInTheDocument();
  });

  it("shows how the hundred points were allocated without asking for them", async () => {
    draftMock.mockResolvedValue(DRAFT);
    const user = userEvent.setup();
    render(<TargetingSetupView canEdit />);
    await fillAndGenerate(user);
    await screen.findByText(/ARIE understood/i);

    expect(screen.getByText("Contact seniority")).toBeInTheDocument();
    expect(screen.getByText("26 pts")).toBeInTheDocument();
    // The importance is shown as a plain word the customer chose from, never
    // as the raw enum value the backend uses.
    expect(screen.getByLabelText(/how much Contact seniority matters/i)).toHaveValue("critical");
    expect(screen.getByLabelText(/how much Recent trigger event matters/i)).toHaveValue("low");
  });

  it("confirms by sending the reviewed profile and never a scoring config", async () => {
    draftMock.mockResolvedValue(DRAFT);
    confirmMock.mockResolvedValue(CONFIRMED);
    const user = userEvent.setup();
    render(<TargetingSetupView canEdit />);
    await fillAndGenerate(user);
    await screen.findByText(/ARIE understood/i);

    await user.click(screen.getByRole("button", { name: /confirm profile/i }));
    await waitFor(() => expect(confirmMock).toHaveBeenCalledTimes(1));

    const payload = confirmMock.mock.calls[0][0];
    expect(payload.profile).toEqual(PROFILE);
    expect(payload.objective).toBe("best_prospects");
    expect(payload).not.toHaveProperty("scoring_config");
    expect(payload).not.toHaveProperty("config");
    expect(payload).not.toHaveProperty("allocation");

    expect(await screen.findByText(/version 2 is now active/i)).toBeInTheDocument();
  });

  it("surfaces the backend's own message when generation fails", async () => {
    draftMock.mockRejectedValue(
      new ArieApiError(
        "AI targeting generation is not configured for this deployment.",
        503,
        "/intelligence/targeting/draft",
      ),
    );
    const user = userEvent.setup();
    render(<TargetingSetupView canEdit />);
    await fillAndGenerate(user);
    expect(await screen.findByText(/not configured for this deployment/i)).toBeInTheDocument();
    // Failing leaves the customer's answers intact so they can retry.
    expect(screen.getByLabelText(/what do you sell/i)).toHaveValue("We wholesale supplements.");
  });

  it("surfaces a budget refusal with the organization's own figures", async () => {
    draftMock.mockRejectedValue(
      new ArieApiError(
        "this organization has reached its $25.0000 monthly AI spend limit.",
        429,
        "/intelligence/targeting/draft",
      ),
    );
    const user = userEvent.setup();
    render(<TargetingSetupView canEdit />);
    await fillAndGenerate(user);
    expect(await screen.findByText(/monthly AI spend limit/i)).toBeInTheDocument();
  });

  it("tells a non-admin they cannot change targeting and disables the form", () => {
    render(<TargetingSetupView canEdit={false} />);
    expect(screen.getByText(/only an owner or admin/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/what do you sell/i)).toBeDisabled();
    expect(screen.getByRole("button", { name: /generate targeting profile/i })).toBeDisabled();
  });

  it("starting over discards the draft without confirming anything", async () => {
    draftMock.mockResolvedValue(DRAFT);
    const user = userEvent.setup();
    render(<TargetingSetupView canEdit />);
    await fillAndGenerate(user);
    await screen.findByText(/ARIE understood/i);

    await user.click(screen.getByRole("button", { name: /start over/i }));
    expect(confirmMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/what do you sell/i)).toBeInTheDocument();
  });

  it("never renders a provider credential", async () => {
    draftMock.mockResolvedValue(DRAFT);
    const user = userEvent.setup();
    const { container } = render(<TargetingSetupView canEdit />);
    await fillAndGenerate(user);
    await screen.findByText(/ARIE understood/i);
    await user.click(screen.getByRole("button", { name: /advanced details/i }));
    expect(container.textContent).not.toMatch(/sk-|api_key|DEEPSEEK/i);
  });
});

describe("TargetingSetupView editing before confirmation", () => {
  beforeEach(() => {
    draftMock.mockReset();
    confirmMock.mockReset();
    draftMock.mockResolvedValue(DRAFT);
    confirmMock.mockResolvedValue(CONFIRMED);
  });

  it("lets a customer change how much something matters and says the preview is stale", async () => {
    const user = userEvent.setup();
    render(<TargetingSetupView canEdit />);
    await fillAndGenerate(user);
    await screen.findByText(/ARIE understood/i);

    expect(screen.queryByText(/out of date/i)).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/how much Company size matters/i), "none");
    expect(screen.getByText(/ARIE recalculates them when you confirm/i)).toBeInTheDocument();
  });

  it("sends the edited profile on confirm, and no recomputed numbers of its own", async () => {
    const user = userEvent.setup();
    render(<TargetingSetupView canEdit />);
    await fillAndGenerate(user);
    await screen.findByText(/ARIE understood/i);

    await user.selectOptions(screen.getByLabelText(/how much Industry matters/i), "critical");
    await user.click(screen.getByRole("button", { name: /confirm profile/i }));
    await waitFor(() => expect(confirmMock).toHaveBeenCalledTimes(1));

    const payload = confirmMock.mock.calls[0][0];
    expect(payload.profile.relative_preferences.industry).toBe("critical");
    // Still only the profile — the client never computes or sends points.
    expect(payload).not.toHaveProperty("scoring_config");
    expect(payload).not.toHaveProperty("allocation");
  });
});
