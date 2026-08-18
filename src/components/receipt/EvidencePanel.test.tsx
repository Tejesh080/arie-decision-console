import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
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
    render(<EvidencePanel providers={providers} evidence={evidence} />);
    expect(screen.getByText("industry")).toBeInTheDocument();
    expect(screen.getByText("dns_web")).toBeInTheDocument();
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
    expect(screen.getAllByText("None this run").length).toBeGreaterThan(0);
    expect(screen.getByText("All providers were called")).toBeInTheDocument();
    // With nothing left uncalled there's no "not reached" story to tell.
    expect(screen.queryByText(/Not evaluated and rejected/)).not.toBeInTheDocument();
  });
});
