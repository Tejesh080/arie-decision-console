import { apiClient } from "./client";
import { getDataMode } from "./mode";
import { mockStore } from "./mock/store";
import type {
  DiscoveryRun,
  DiscoveryRunWithOpportunities,
  Opportunity,
  StartDiscoveryRunRequest,
} from "./types";

/**
 * Product Pivot: "tell me what you sell and I will find the opportunities
 * worth your attention." `startDiscoveryRun` runs synchronously on the
 * backend — see `arie.discovery.orchestrator` — so this resolves with the
 * finished run and its ranked shortlist in one call; there is no separate
 * polling loop to write.
 */
export async function startDiscoveryRun(
  input: StartDiscoveryRunRequest,
): Promise<DiscoveryRunWithOpportunities> {
  if (getDataMode() === "mock") return mockRun(input);
  // Above the transport default: a real run does a search-plan call, a
  // discovery search, a screening call, and drives promoted leads through
  // scoring — genuinely slower than a plain read, matching `submitLead`'s
  // own reasoning for an extended timeout. Kept under the proxy route's own
  // (longer) backend-side timeout so the browser doesn't give up first.
  const result = await apiClient.post<DiscoveryRunWithOpportunities>("/discovery/runs", input, {
    timeoutMs: 58_000,
  });
  lastMockRun = null;
  return result;
}

export async function getDiscoveryRun(runId: string): Promise<DiscoveryRun> {
  if (getDataMode() === "mock") return mockGetRun(runId);
  return apiClient.get<DiscoveryRun>(`/discovery/runs/${encodeURIComponent(runId)}`);
}

export async function getDiscoveryOpportunities(
  runId: string,
): Promise<DiscoveryRunWithOpportunities> {
  if (getDataMode() === "mock") return mockGetOpportunities(runId);
  return apiClient.get<DiscoveryRunWithOpportunities>(
    `/discovery/runs/${encodeURIComponent(runId)}/opportunities`,
  );
}

export async function listDiscoveryRuns(): Promise<DiscoveryRun[]> {
  if (getDataMode() === "mock") return lastMockRun ? [lastMockRun.run] : [];
  return apiClient.get<DiscoveryRun[]>("/discovery/runs");
}

// ------------------------------------------------------------------ mock --
//
// Mock mode has no search provider and no model, so — like `mockDraft` in
// `targeting.ts` — this is a fixed, obviously-synthetic scenario rather than
// a simulation of a real one: the same supplement-wholesaler story mock
// mode's targeting draft already tells. Kept in-memory only, not persisted
// to localStorage, the same acceptable simplification `mock/store.ts` makes
// for ICP profiles and batches (a reload resetting it is fine for a demo).

let lastMockRun: DiscoveryRunWithOpportunities | null = null;

const MOCK_OPPORTUNITIES: readonly Omit<Opportunity, "candidate_id" | "lead_id">[] = [
  {
    company_name: "Northwind Fitness Group",
    domain: "northwindfitness.example",
    priority: "contact_first",
    next_action: "contact_now",
    score: 84.2,
    confidence: 0.81,
    short_reason:
      "Strong match: multi-location gym operator, mid-size, matches your preferred industry.",
    key_evidence: ["employee count", "industry", "title seniority"],
    missing_information: [],
    buyer: {
      seniority: "c_level",
      function: "operations",
      name_known: false,
      source: "simulated",
      confidence: 0.7,
    },
    research_performed: false,
    discovery_source: "mock_discovery",
    source_url: "https://northwindfitness.example",
    search_query: "multi-location gyms Australia",
  },
  {
    company_name: "Bluepeak Supplement Co",
    domain: "bluepeaksupplements.example",
    priority: "worth_pursuing",
    next_action: "find_decision_maker",
    score: 71.5,
    confidence: 0.62,
    short_reason: "Possible match: supplement distributor, but the contact isn't identified yet.",
    key_evidence: ["industry", "employee count"],
    missing_information: ["contact seniority"],
    buyer: null,
    research_performed: true,
    discovery_source: "mock_discovery",
    source_url: "https://bluepeaksupplements.example",
    search_query: "supplement distributors Australia",
  },
  {
    company_name: "Ironbark Distributors",
    domain: "ironbarkdist.example",
    priority: "contact_first",
    next_action: "email_first",
    score: 79.8,
    confidence: 0.74,
    short_reason: "Strong match: established distributor with a known operations contact.",
    key_evidence: ["employee count", "industry"],
    missing_information: ["buying intent"],
    buyer: {
      seniority: "director",
      function: "operations",
      name_known: false,
      source: "simulated",
      confidence: 0.65,
    },
    research_performed: false,
    discovery_source: "mock_discovery",
    source_url: "https://ironbarkdist.example",
    search_query: "supplement distributors Australia",
  },
  {
    company_name: "Coastal Nutrition Holdings",
    domain: "coastalnutrition.example",
    priority: "review",
    next_action: "research_more",
    score: 58.1,
    confidence: 0.41,
    short_reason: "Borderline: some fit signals, not enough evidence to decide yet.",
    key_evidence: ["industry"],
    missing_information: ["employee count", "contact seniority"],
    buyer: null,
    research_performed: true,
    discovery_source: "mock_discovery",
    source_url: "https://coastalnutrition.example",
    search_query: "sports nutrition retailers Australia",
  },
  {
    company_name: "Solstice Wellness Partners",
    domain: "solsticewellness.example",
    priority: "skip",
    next_action: "skip",
    score: 22.4,
    confidence: 0.58,
    short_reason: "This lead falls outside your targeting profile — solo practice, no premises.",
    key_evidence: ["industry", "employee count"],
    missing_information: [],
    buyer: null,
    research_performed: false,
    discovery_source: "mock_discovery",
    source_url: "https://solsticewellness.example",
    search_query: "gym chains Australia",
  },
] as const;

function mockFunnel(finalCount: number) {
  return {
    search_queries: 4,
    raw_candidates: 37,
    unique_companies: 24,
    screened: 24,
    promising: 9,
    possible: 6,
    unlikely: 9,
    insufficient_info: 0,
    promoted_to_leads: 15,
    research_candidates: 6,
    research_calls: 4,
    buyer_lookups: 3,
    final_opportunities: finalCount,
    llm_calls: 2,
    llm_cost_usd: "0.0000",
    provider_calls: 15,
    provider_cost_usd: "0.0000",
  };
}

async function mockRun(input: StartDiscoveryRunRequest): Promise<DiscoveryRunWithOpportunities> {
  // A short, deliberate delay so the "Finding opportunities…" progress state
  // in the UI is reachable in mock mode too, not skipped entirely.
  await new Promise((resolve) => setTimeout(resolve, 900));

  const count = Math.max(
    1,
    Math.min(input.requested_opportunity_count ?? 20, MOCK_OPPORTUNITIES.length),
  );
  const opportunities: Opportunity[] = MOCK_OPPORTUNITIES.slice(0, count).map((template) => ({
    ...template,
    candidate_id: crypto.randomUUID(),
    // A real, registered mock lead (not just a random id) — so
    // `FeedbackButtons` on the opportunity card can actually save and read
    // back feedback in mock mode, the same as it does for every other lead.
    // The card still shows this module's own canned score/priority/reason,
    // never `mockStore`'s independently-derived recommendation.
    lead_id: mockStore.createLead({
      source: "discovery",
      email: `discovery+${crypto.randomUUID().slice(0, 8)}@${template.domain}`,
      company_domain: template.domain,
      company_name: template.company_name,
    }).lead_id,
  }));

  const now = new Date().toISOString();
  const run: DiscoveryRun = {
    run_id: crypto.randomUUID(),
    status: "complete",
    requested_opportunity_count: input.requested_opportunity_count ?? 20,
    market: input.market ?? null,
    max_candidates: input.max_candidates ?? 100,
    profile_version: 1,
    error_detail: null,
    funnel: mockFunnel(opportunities.length),
    created_at: now,
    started_at: now,
    completed_at: now,
  };

  lastMockRun = { run, opportunities };
  return lastMockRun;
}

function mockGetRun(runId: string): DiscoveryRun {
  if (lastMockRun && lastMockRun.run.run_id === runId) return lastMockRun.run;
  throw new Error(`no discovery run ${runId}`);
}

function mockGetOpportunities(runId: string): DiscoveryRunWithOpportunities {
  if (lastMockRun && lastMockRun.run.run_id === runId) return lastMockRun;
  throw new Error(`no discovery run ${runId}`);
}
