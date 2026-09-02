import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HistoricalOutcomes } from "./HistoricalOutcomes";
import { ArieApiError } from "@/lib/api/errors";
import type { ICPProfile, OutcomeAnalysis, RevisionProposal } from "@/lib/api/types";

const { analyzeMock, getProposalMock, acceptMock, rejectMock } = vi.hoisted(() => ({
  analyzeMock: vi.fn(),
  getProposalMock: vi.fn(),
  acceptMock: vi.fn(),
  rejectMock: vi.fn(),
}));
vi.mock("@/lib/api/mapping", () => ({
  analyzeOutcomes: analyzeMock,
  getProposal: getProposalMock,
  acceptProposal: acceptMock,
  rejectProposal: rejectMock,
}));

const ANALYSIS: OutcomeAnalysis = {
  total_rows: 50,
  labelled_rows: 50,
  positive_count: 21,
  negative_count: 29,
  baseline_rate: 0.42,
  groups: [
    {
      dimension: "employee_count",
      group_key: "employees_51_200",
      group_label: "companies with 51-200 people",
      sample_size: 26,
      positive_count: 16,
      negative_count: 10,
      positive_rate: 0.6153,
      baseline_rate: 0.42,
      rate_difference: 0.1953,
      signal: "moderate",
      sentence:
        "In this dataset, companies with 51-200 people had a higher positive-outcome rate " +
        "(62%) than the overall rate (42%), across 26 examples.",
    },
    {
      dimension: "employee_count",
      group_key: "employees_11_50",
      group_label: "companies with 11-50 people",
      sample_size: 24,
      positive_count: 5,
      negative_count: 19,
      positive_rate: 0.2083,
      baseline_rate: 0.42,
      rate_difference: -0.2117,
      signal: "moderate",
      sentence:
        "In this dataset, companies with 11-50 people had a lower positive-outcome rate " +
        "(21%) than the overall rate (42%), across 24 examples.",
    },
  ],
  unrecognised_labels: { "pending renewal": 2 },
  warnings: [],
  revenue_total_usd: null,
  interpretation: "Mid-sized companies did better in this data.",
  caveats: [],
  proposal_id: "prop-1",
};

const PROPOSAL: RevisionProposal = {
  proposal_id: "prop-1",
  organization_id: "org-1",
  profile_id: "prof-1",
  profile_version: 2,
  source: "historical_outcomes",
  status: "proposed",
  summary: "Mid-sized companies did better in this data.",
  changes: [
    {
      kind: "employee_band",
      dimension: "employee_count",
      target: "employees_51_200",
      target_label: "companies with 51-200 people",
      from_value: "acceptable",
      to_value: "preferred",
      rationale: "In this dataset, they had a higher positive-outcome rate.",
    },
  ],
  observations: [],
  caveats: ["These are patterns in your own past data, not proof of anything."],
  supporting_statistics: { labelled_rows: 50 },
  evidence_strength: "moderate",
  sample_size: 26,
  created_at: "2026-09-02T00:00:00Z",
  resolved_at: null,
  resulting_profile_id: null,
};

const APPLIED = { version: 3, profile_id: "prof-2" } as ICPProfile;

function csv(): File {
  return new File(["company,outcome\nAcme,won\n"], "history.csv", { type: "text/csv" });
}

async function upload(user: ReturnType<typeof userEvent.setup>) {
  await user.upload(screen.getByLabelText(/past results csv/i), csv());
}

describe("HistoricalOutcomes", () => {
  beforeEach(() => {
    analyzeMock.mockReset();
    getProposalMock.mockReset();
    acceptMock.mockReset();
    rejectMock.mockReset();
  });

  it("presents itself as optional", () => {
    render(<HistoricalOutcomes canEdit />);
    expect(screen.getByText("Optional")).toBeInTheDocument();
    expect(screen.getByText(/Have past results\?/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing changes unless you choose/i)).toBeInTheDocument();
  });

  it("shows a loading state while analysing", async () => {
    let resolve: (value: OutcomeAnalysis) => void = () => {};
    analyzeMock.mockReturnValue(
      new Promise<OutcomeAnalysis>((r) => {
        resolve = r;
      }),
    );
    const user = userEvent.setup();
    render(<HistoricalOutcomes canEdit />);
    await upload(user);
    expect(await screen.findByText(/looking for patterns/i)).toBeInTheDocument();
    resolve({ ...ANALYSIS, proposal_id: null });
    await waitFor(() => expect(screen.getByText(/Historical signals/i)).toBeInTheDocument());
  });

  it("renders each group with its sample size, rate and signal strength", async () => {
    analyzeMock.mockResolvedValue({ ...ANALYSIS, proposal_id: null });
    const user = userEvent.setup();
    render(<HistoricalOutcomes canEdit />);
    await upload(user);

    expect(await screen.findByText(/Historical signals/i)).toBeInTheDocument();
    expect(screen.getByText("Companies with 51-200 people")).toBeInTheDocument();
    expect(screen.getByText(/26 examples · 62% positive · 42% overall/)).toBeInTheDocument();
    expect(screen.getAllByText("Moderate")).toHaveLength(2);
  });

  it("renders the backend's associational sentence rather than writing its own", async () => {
    analyzeMock.mockResolvedValue({ ...ANALYSIS, proposal_id: null });
    const user = userEvent.setup();
    render(<HistoricalOutcomes canEdit />);
    await upload(user);

    const sentence = await screen.findByText(/In this dataset, companies with 51-200 people/);
    expect(sentence).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\bbecause\b/i);
    expect(document.body.textContent).not.toMatch(/will increase/i);
  });

  it("reports unreadable outcome labels so they can be fixed", async () => {
    analyzeMock.mockResolvedValue({ ...ANALYSIS, proposal_id: null });
    const user = userEvent.setup();
    render(<HistoricalOutcomes canEdit />);
    await upload(user);
    expect(await screen.findByText(/pending renewal \(2\)/)).toBeInTheDocument();
  });

  it("says plainly when the data supports no suggestion", async () => {
    analyzeMock.mockResolvedValue({
      ...ANALYSIS,
      groups: [],
      proposal_id: null,
      warnings: ["This file has 6 rows ARIE could read an outcome from."],
    });
    const user = userEvent.setup();
    render(<HistoricalOutcomes canEdit />);
    await upload(user);

    expect(await screen.findByText(/no targeting change to suggest/i)).toBeInTheDocument();
    expect(screen.getByText(/6 rows ARIE could read/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /apply this change/i })).not.toBeInTheDocument();
  });

  it("presents a proposal as a suggestion that has changed nothing", async () => {
    analyzeMock.mockResolvedValue(ANALYSIS);
    getProposalMock.mockResolvedValue(PROPOSAL);
    const user = userEvent.setup();
    render(<HistoricalOutcomes canEdit />);
    await upload(user);

    expect(await screen.findByText("From your past results")).toBeInTheDocument();
    expect(screen.getByText("Suggestion")).toBeInTheDocument();
    expect(screen.getByText(/Moderate evidence · 26 examples/)).toBeInTheDocument();
    expect(screen.getByText(/acceptable → preferred/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing has changed yet/i)).toBeInTheDocument();
    expect(screen.getByText(/not proof of anything/i)).toBeInTheDocument();
    // Nothing was applied by rendering it.
    expect(acceptMock).not.toHaveBeenCalled();
  });

  it("applies a suggestion only when the customer presses the button", async () => {
    analyzeMock.mockResolvedValue(ANALYSIS);
    getProposalMock.mockResolvedValue(PROPOSAL);
    acceptMock.mockResolvedValue(APPLIED);
    const onProfileUpdated = vi.fn();
    const user = userEvent.setup();
    render(<HistoricalOutcomes canEdit onProfileUpdated={onProfileUpdated} />);
    await upload(user);
    await screen.findByText("From your past results");

    expect(acceptMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /apply this change/i }));

    await waitFor(() => expect(acceptMock).toHaveBeenCalledWith("prop-1", expect.any(String)));
    expect(onProfileUpdated).toHaveBeenCalledWith(APPLIED);
    expect(await screen.findByText(/Applied as version 3/)).toBeInTheDocument();
  });

  it("dismissing leaves targeting unchanged and says so", async () => {
    analyzeMock.mockResolvedValue(ANALYSIS);
    getProposalMock.mockResolvedValue(PROPOSAL);
    rejectMock.mockResolvedValue({ ...PROPOSAL, status: "rejected" });
    const user = userEvent.setup();
    render(<HistoricalOutcomes canEdit />);
    await upload(user);
    await screen.findByText("From your past results");

    await user.click(screen.getByRole("button", { name: /not now/i }));
    await waitFor(() => expect(rejectMock).toHaveBeenCalledWith("prop-1"));
    expect(await screen.findByText(/Your targeting is unchanged/i)).toBeInTheDocument();
    expect(acceptMock).not.toHaveBeenCalled();
  });

  it("surfaces the backend's message when analysis fails", async () => {
    analyzeMock.mockRejectedValue(
      new ArieApiError(
        "missing a column saying what happened with each company",
        422,
        "/intelligence/outcomes/analyze",
      ),
    );
    const user = userEvent.setup();
    render(<HistoricalOutcomes canEdit />);
    await upload(user);
    expect(await screen.findByText(/missing a column saying what happened/)).toBeInTheDocument();
  });

  it("shows the statistics even when the model wrote nothing", async () => {
    analyzeMock.mockResolvedValue({ ...ANALYSIS, interpretation: null, proposal_id: null });
    const user = userEvent.setup();
    render(<HistoricalOutcomes canEdit />);
    await upload(user);
    expect(await screen.findByText(/Historical signals/i)).toBeInTheDocument();
    expect(screen.getByText("Companies with 51-200 people")).toBeInTheDocument();
  });

  it("disables the upload for a member who cannot change targeting", () => {
    render(<HistoricalOutcomes canEdit={false} />);
    expect(screen.getByLabelText(/past results csv/i)).toBeDisabled();
  });
});
