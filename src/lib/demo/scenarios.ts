import type {
  LeadRecommendationResponse,
  ReceiptResponse,
  ReviewResponse,
} from "@/lib/api/types";

/**
 * Frozen data for the public, permanently login-free `/demo` route.
 *
 * Every value below is hand-authored, not fetched — there is no lead, no
 * job, and no backend call behind any of it. The three scenarios exist so a
 * visitor who cannot (or should not have to) sign in still sees ARIE's real
 * receipt and recommendation UI, fed data that never changes and was never
 * billed.
 *
 * These numbers are deliberately *not* copied from `mock/store.ts`'s own
 * `AUTONOMOUS_TEMPLATE`/`ESCALATION_TEMPLATE` (used by `NewLeadForm`'s
 * `?run=` presets against a live-but-simulated backend). This file has to
 * keep working with zero backend at all, forever, including after a real
 * account exists — so it stands alone rather than importing anything from
 * `lib/api/mock`. The "confident" scenario mirrors the shape of the real
 * autonomous-decision template closely (same field names, same kind of
 * numbers) so the rendering is representative; the "review" scenario is
 * authored from scratch specifically to exercise
 * `evidence_sufficiency: "insufficient_evidence"` — the reachable score
 * range still straddles the reject threshold, which the real
 * `ESCALATION_TEMPLATE` (a low-confidence but *settled* reject) does not
 * demonstrate.
 */

export type DemoScenarioId = "confident" | "review" | "shadow";

export interface DemoLeadMeta {
  full_name: string;
  email: string;
  company_name: string;
  company_domain: string;
}

export interface DemoScenario {
  id: DemoScenarioId;
  /** Short label for the tab/segmented control. */
  label: string;
  /** One line, under the label, naming the outcome. */
  outcome: string;
  /** A sentence or two of context, shown above the receipt. */
  blurb: string;
  lead: DemoLeadMeta;
  receipt: ReceiptResponse;
  recommendation: LeadRecommendationResponse;
  /** Only the "review" scenario has one — already resolved (`is_pending:
   * false`), never a pending form, so this page can render the real
   * `HumanReviewPanel` with zero risk of a visitor triggering a write. */
  review: ReviewResponse | null;
}

// ------------------------------------------------------------- scenario 1 --
// Confident enough to act: evidence resolves cleanly, confidence clears the
// autonomy threshold, ARIE routes the lead without asking anyone.

const CONFIDENT_LEAD: DemoLeadMeta = {
  full_name: "Nadia Delacroix",
  email: "nadia.delacroix@lumen500.com",
  company_name: "Lumen500",
  company_domain: "lumen500.com",
};

const CONFIDENT_RECEIPT: ReceiptResponse = {
  receipt_version: "1",
  lead_id: "demo-confident-enough-to-act",
  status: "decided",
  lead_status: "AUTO_ROUTED",
  created_at: "2026-09-18T16:04:12.000Z",
  shadow: false,
  decision: {
    recommended_action: "auto_route",
    autonomous: true,
    final_status: "AUTO_ROUTED",
    human_override: false,
    evidence_sufficiency: "settled",
  },
  score: {
    value: 78.4,
    threshold_qualify: 65.0,
    threshold_reject: 55.0,
    bounds: { lower: 68.0, upper: 91.5 },
    confidence: 0.87,
    tau: 0.79,
  },
  stopping: {
    reason_code: "confidence_reached",
    explanation:
      "The calibrated confidence model judged this decision reliable enough to act on without a human, based on the evidence collected so far.",
  },
  versions: {
    policy: "calibrated_bounds",
    scorer: "icp-1.0.0",
    confidence_calibration: "platt",
    icp_profile_id: null,
    icp_profile_version: null,
  },
  cost: {
    provider_cost_usd: "0.0678",
    model_cost_usd: "0.0000",
    total_cost_usd: "0.0678",
    budget_usd_cap: "1.50",
  },
  evidence: {
    cache_hits: 0,
    provider_calls: 4,
    items: [
      { field: "title_seniority", source: "contact_enrich", confidence: 0.9, contested: true },
      { field: "title_function", source: "contact_enrich", confidence: 0.88, contested: false },
      { field: "industry", source: "firmographics_basic", confidence: 0.88, contested: false },
      {
        field: "employee_count",
        source: "firmographics_basic",
        confidence: 0.85,
        contested: false,
      },
    ],
    unknown_fields: ["buying_intent", "recent_trigger_event", "disqualifying_flag"],
  },
  providers: {
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
        cost_usd: "0.0120",
        latency_ms: 310,
        cache_hit: false,
      },
      {
        provider: "contact_enrich",
        status: "success",
        cost_usd: "0.0550",
        latency_ms: 460,
        cache_hit: false,
      },
    ],
    not_called: ["internal_crm", "firmographics_premium", "intent_signals", "deep_research"],
  },
  human_review: null,
};

const CONFIDENT_RECOMMENDATION: LeadRecommendationResponse = {
  lead_id: CONFIDENT_RECEIPT.lead_id,
  priority: "contact_first",
  next_action: "contact_now",
  machine_decision: "auto_route",
  score: 78.4,
  confidence: 0.87,
  confidence_band: "high",
  short_reason:
    "Strong match based on contact seniority, contact function, industry. Buying intent is still unknown.",
  key_evidence: ["contact seniority", "contact function", "industry", "company size"],
  missing_information: ["buying intent", "a recent trigger event", "a disqualifying condition"],
  research_status: "researched",
  explanation_status: "not_requested",
  profile_version: null,
  shadow: false,
  execution_mode: "simulated",
  evidence_sufficiency: "settled",
};

// -------------------------------------------------------------- scenario 2 --
// Insufficient evidence / human review: two providers never resolve, one
// fails outright, and the reachable score range still straddles the reject
// threshold. ARIE does not have enough to conclude the lead is bad — a human
// reviewed it and, agreeing evidence was still thin, routed it to manual
// follow-up rather than closing it out. The review is already resolved
// (`is_pending: false`) so `HumanReviewPanel` renders its pure,
// non-interactive `ResolvedSequence` — there is no submit action for a
// visitor to trigger.

const REVIEW_LEAD: DemoLeadMeta = {
  full_name: "Marcus Webb",
  email: "marcus.webb@fenwickindustrial.com",
  company_name: "Fenwick Industrial",
  company_domain: "fenwickindustrial.com",
};

const REVIEW_RECEIPT: ReceiptResponse = {
  receipt_version: "1",
  lead_id: "demo-insufficient-evidence-human-review",
  status: "decided",
  lead_status: "MANUAL_REVIEW",
  created_at: "2026-09-14T09:21:03.000Z",
  shadow: false,
  decision: {
    recommended_action: "reject",
    autonomous: false,
    final_status: "MANUAL_REVIEW",
    human_override: true,
    evidence_sufficiency: "insufficient_evidence",
  },
  score: {
    value: 51.2,
    threshold_qualify: 65.0,
    threshold_reject: 55.0,
    bounds: { lower: 42.0, upper: 61.5 },
    confidence: 0.42,
    tau: 0.8,
  },
  stopping: {
    reason_code: "budget_exhausted",
    explanation:
      "ARIE spent its evidence budget for this lead before confidence cleared the autonomy threshold or the reachable score range fully settled — two providers were never reached.",
  },
  versions: {
    policy: "calibrated_bounds",
    scorer: "icp-1.0.0",
    confidence_calibration: "platt",
    icp_profile_id: null,
    icp_profile_version: null,
  },
  cost: {
    provider_cost_usd: "0.0128",
    model_cost_usd: "0.0000",
    total_cost_usd: "0.0128",
    budget_usd_cap: "1.50",
  },
  evidence: {
    cache_hits: 0,
    provider_calls: 6,
    items: [
      { field: "title_seniority", source: "inbound_payload", confidence: 0.55, contested: true },
      { field: "industry", source: "firmographics_basic", confidence: 0.8, contested: false },
      {
        field: "employee_count",
        source: "firmographics_basic",
        confidence: 0.85,
        contested: false,
      },
    ],
    unknown_fields: [
      "title_function",
      "buying_intent",
      "recent_trigger_event",
      "disqualifying_flag",
    ],
  },
  providers: {
    called: [
      {
        provider: "inbound_payload",
        status: "success",
        cost_usd: "0.0000",
        latency_ms: 0,
        cache_hit: false,
      },
      {
        provider: "internal_crm",
        status: "miss",
        cost_usd: "0.0000",
        latency_ms: 22,
        cache_hit: false,
      },
      {
        provider: "dns_web",
        status: "success",
        cost_usd: "0.0008",
        latency_ms: 210,
        cache_hit: false,
      },
      {
        provider: "firmographics_basic",
        status: "success",
        cost_usd: "0.0120",
        latency_ms: 340,
        cache_hit: false,
      },
      {
        provider: "contact_enrich",
        status: "error",
        cost_usd: "0.0000",
        latency_ms: 480,
        cache_hit: false,
      },
      {
        provider: "intent_signals",
        status: "timeout",
        cost_usd: "0.0000",
        latency_ms: 5200,
        cache_hit: false,
      },
    ],
    not_called: ["firmographics_premium", "deep_research"],
  },
  human_review: {
    review_id: "demo-review-fenwick-industrial",
    required: true,
    reviewer: "Jordan Vance",
    original_decision: "reject",
    action: "edit",
    final_decision: "manual_review",
    responded_at: "2026-09-14T10:03:47.000Z",
  },
};

const REVIEW_RECOMMENDATION: LeadRecommendationResponse = {
  lead_id: REVIEW_RECEIPT.lead_id,
  priority: "worth_pursuing",
  next_action: "email_first",
  machine_decision: "reject",
  score: 51.2,
  confidence: 0.42,
  confidence_band: "low",
  short_reason:
    "Possible match based on contact seniority, industry, company size. Contact function is still unknown.",
  key_evidence: ["contact seniority", "industry", "company size"],
  missing_information: [
    "contact function",
    "buying intent",
    "a recent trigger event",
    "a disqualifying condition",
  ],
  research_status: "researched",
  explanation_status: "not_requested",
  profile_version: null,
  shadow: false,
  execution_mode: "simulated",
  evidence_sufficiency: "insufficient_evidence",
};

const REVIEW_REVIEW: ReviewResponse = {
  review_id: "demo-review-fenwick-industrial",
  lead_id: REVIEW_RECEIPT.lead_id,
  requested_at: "2026-09-14T09:21:15.000Z",
  reviewer: "Jordan Vance",
  original_decision: "reject",
  final_decision: "manual_review",
  notes:
    "The reachable score range still crosses our reject line and two fields never resolved — I don't think we can call this dead. Routing to manual follow-up instead of closing it out; worth revisiting once buying-intent data comes through.",
  responded_at: "2026-09-14T10:03:47.000Z",
  is_pending: false,
  lead_status: "MANUAL_REVIEW",
  lead_version: 2,
};

// -------------------------------------------------------------- scenario 3 --
// Shadow evaluation: the exact same evidence and decision as "Confident
// enough to act", computed a second time in observational mode — ARIE
// reaches the identical recommendation but takes no action: nothing routed,
// nothing rejected, nobody asked.

const SHADOW_RECEIPT: ReceiptResponse = {
  ...CONFIDENT_RECEIPT,
  lead_id: "demo-shadow-evaluation",
  lead_status: "SHADOW_EVALUATED",
  shadow: true,
  decision: {
    ...CONFIDENT_RECEIPT.decision!,
    final_status: "SHADOW_EVALUATED",
  },
};

const SHADOW_RECOMMENDATION: LeadRecommendationResponse = {
  ...CONFIDENT_RECOMMENDATION,
  lead_id: SHADOW_RECEIPT.lead_id,
  shadow: true,
};

// ------------------------------------------------------------------- index --

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: "confident",
    label: "Confident enough to act",
    outcome: "Auto-routed",
    blurb:
      "Most of the evidence resolves cleanly and confidence clears the autonomy threshold, so ARIE routes the lead without asking anyone.",
    lead: CONFIDENT_LEAD,
    receipt: CONFIDENT_RECEIPT,
    recommendation: CONFIDENT_RECOMMENDATION,
    review: null,
  },
  {
    id: "review",
    label: "Insufficient evidence",
    outcome: "Sent to manual review",
    blurb:
      "One provider fails and two are never reached, so the reachable score range still crosses the reject threshold. ARIE stops short of a confident verdict and a reviewer routes it to follow-up rather than closing it out.",
    lead: REVIEW_LEAD,
    receipt: REVIEW_RECEIPT,
    recommendation: REVIEW_RECOMMENDATION,
    review: REVIEW_REVIEW,
  },
  {
    id: "shadow",
    label: "Shadow evaluation",
    outcome: "Watched, not acted on",
    blurb:
      "The same identity as “Confident enough to act,” run a second time in observational mode: ARIE computes the full recommendation and then deliberately does nothing with it.",
    lead: {
      ...CONFIDENT_LEAD,
      full_name: `${CONFIDENT_LEAD.full_name} (shadow run)`,
    },
    receipt: SHADOW_RECEIPT,
    recommendation: SHADOW_RECOMMENDATION,
    review: null,
  },
];

export function findDemoScenario(id: string | null | undefined): DemoScenario | undefined {
  return DEMO_SCENARIOS.find((s) => s.id === id);
}
