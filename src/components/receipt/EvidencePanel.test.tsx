import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { EvidencePanel } from "./EvidencePanel";
import type { ReceiptEvidence, ReceiptProviders } from "@/lib/api/types";

const providers: ReceiptProviders = {
  called: [
    {
      provider: "inbound_payload",
      status: "success",
      cost_usd: "0.0000",
      latency_ms: 0,
      cache_hit: false,
    },
    {
      provider: "dns_web",
      status: "success",
      cost_usd: "0.0008",
      latency_ms: 240,
      cache_hit: false,
    },
    {
      provider: "firmographics_basic",
      status: "success",
      cost_usd: "0.0000",
      latency_ms: 10,
      cache_hit: true,
    },
  ],
  not_called: ["deep_research", "intent_signals"],
};

const evidence: ReceiptEvidence = {
  cache_hits: 1,
  provider_calls: 2,
  items: [{ field: "industry", source: "dns_web", confidence: 0.7, contested: false }],
  unknown_fields: ["disqualifying_flag"],
};

/**
 * The ledger and the field list each render twice: a table for `sm` and up,
 * a stacked card list below it, with CSS choosing between them. Only one is
 * ever displayed (and therefore only one is ever in the accessibility tree),
 * but JSDOM applies no media queries, so both are queryable here. Assertions
 * that would otherwise be ambiguous scope to the table.
 */
function table(container: HTMLElement): HTMLElement {
  return container.querySelector("table")!;
}

describe("EvidencePanel", () => {
  it("splits fresh calls from cache reuse instead of reporting a bare total", () => {
    render(<EvidencePanel providers={providers} evidence={evidence} />);
    expect(screen.getByText("Fresh calls (2)")).toBeInTheDocument();
    expect(screen.getByText("Cache reuse (1)")).toBeInTheDocument();
    // The misleading bare-count phrasing must never appear.
    expect(screen.queryByText(/^3 providers called$/)).not.toBeInTheDocument();
  });

  it("lists not-called providers with a neutral, non-evaluative footnote", () => {
    render(<EvidencePanel providers={providers} evidence={evidence} />);
    expect(screen.getByText("Not called (2)")).toBeInTheDocument();
    expect(screen.getByText("deep_research")).toBeInTheDocument();
    expect(screen.getByText(/Not evaluated and rejected — simply not reached/)).toBeInTheDocument();
    // Must never claim a specific causal reason it wasn't asked for.
    expect(screen.queryByText(/could not change the decision/)).not.toBeInTheDocument();
  });

  it("renders known evidence fields with their winning source and contested flag", () => {
    const { container } = render(<EvidencePanel providers={providers} evidence={evidence} />);
    // "dns_web" legitimately appears as a ledger row *and* as the winning
    // source for `industry`, so this asserts on the field's own row rather
    // than on a bare page-wide text match.
    const fieldsTable = container.querySelectorAll("table")[1];
    const row = within(fieldsTable as HTMLElement)
      .getByText("industry")
      .closest("tr")!;
    expect(within(row).getByText("dns_web")).toBeInTheDocument();
    expect(within(row).getByText("70%")).toBeInTheDocument();
  });

  it("renders unknown fields as a distinct list", () => {
    render(<EvidencePanel providers={providers} evidence={evidence} />);
    expect(screen.getByText("disqualifying_flag")).toBeInTheDocument();
  });

  it("shows an honest empty state when nothing was called or nothing is unknown", () => {
    render(
      <EvidencePanel
        providers={{ called: [], not_called: [] }}
        evidence={{ cache_hits: 0, provider_calls: 0, items: [], unknown_fields: [] }}
      />,
    );
    expect(screen.getByText("Fresh calls (0)")).toBeInTheDocument();
    expect(screen.getByText(/None this run/)).toBeInTheDocument();
    expect(screen.getByText(/All providers were called/)).toBeInTheDocument();
    // With nothing left uncalled there's no "not reached" story to tell.
    expect(screen.queryByText(/Not evaluated and rejected/)).not.toBeInTheDocument();
  });

  /**
   * `providers.called[].status` used to be dropped entirely, which rendered a
   * provider that errored or returned nothing identically to one that
   * returned usable data. These three cases pin that down.
   */
  it("distinguishes a provider that returned data from one that returned none", () => {
    const { container } = render(
      <EvidencePanel
        providers={{
          called: [
            {
              provider: "contact_enrich",
              status: "success",
              cost_usd: "0",
              latency_ms: 5,
              cache_hit: false,
            },
            {
              provider: "internal_crm",
              status: "miss",
              cost_usd: "0",
              latency_ms: 40,
              cache_hit: false,
            },
          ],
          not_called: [],
        }}
        evidence={{ cache_hits: 0, provider_calls: 2, items: [], unknown_fields: [] }}
      />,
    );
    expect(within(table(container)).getByText("Returned data")).toBeInTheDocument();
    expect(within(table(container)).getByText("No data")).toBeInTheDocument();
  });

  it("surfaces a provider that was charged for and returned nothing", () => {
    render(
      <EvidencePanel
        providers={{
          called: [
            {
              provider: "intent_signals",
              status: "miss",
              cost_usd: "0.25",
              latency_ms: 2301,
              cache_hit: false,
            },
          ],
          not_called: [],
        }}
        evidence={{ cache_hits: 0, provider_calls: 1, items: [], unknown_fields: [] }}
      />,
    );
    // The waste ARIE exists to avoid must never need reconstructing from a table.
    expect(
      screen.getByText(/intent_signals cost \$0\.2500 and returned no usable evidence/),
    ).toBeInTheDocument();
  });

  it("reports a failed provider call rather than hiding it among the successes", () => {
    const { container } = render(
      <EvidencePanel
        providers={{
          called: [
            {
              provider: "deep_research",
              status: "error",
              cost_usd: "0",
              latency_ms: 1753,
              cache_hit: false,
            },
          ],
          not_called: [],
        }}
        evidence={{ cache_hits: 0, provider_calls: 1, items: [], unknown_fields: [] }}
      />,
    );
    expect(within(table(container)).getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText(/deep_research did not complete/)).toBeInTheDocument();
  });
});
