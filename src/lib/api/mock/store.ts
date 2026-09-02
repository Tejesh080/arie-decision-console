import { ArieApiError, ArieConflictError, ArieNotFoundError, ArieValidationError } from "../errors";
import type {
  AcceptInvitationRequest,
  Batch,
  BatchRow,
  BatchRowsPage,
  BillingPortalResponse,
  BillingResponse,
  CheckoutSessionResponse,
  ConfidenceBand,
  CopilotIntent,
  CopilotLeadReference,
  CopilotResponse,
  CreateICPProfileRequest,
  CreateInvitationRequest,
  CreateOrganizationRequest,
  CreateOrganizationResponse,
  CustomerPriority,
  ExecuteResearchRequest,
  FeedbackResponse,
  HealthResponse,
  ICPProfile,
  ICPProfileConfig,
  IngestLeadRequest,
  IngestLeadResponse,
  InvitationCreatedResponse,
  InvitationResponse,
  LeadCopilotResponse,
  LeadExplanationResponse,
  LeadRecommendationResponse,
  LeadResponse,
  LeadStatus,
  MemberResponse,
  NextAction,
  OnboardingStatusResponse,
  OrganizationResponse,
  ProviderId,
  ProviderStatusResponse,
  ReceiptResponse,
  ResearchExecutionResponse,
  ResearchPlanResponse,
  ResearchReasonCode,
  ResearchTargetField,
  ReviewDecisionRequest,
  ReviewDecisionResponse,
  ReviewResponse,
  SubmitFeedbackRequest,
  SetProviderCredentialRequest,
  SetProviderEnabledRequest,
  UpdateMemberRoleRequest,
  UpdateOrganizationRequest,
  UsageAgainstLimitsResponse,
  UsageSummary,
} from "../types";
import {
  AWAITING_REVIEW_STATUSES,
  FAILURE_STATUSES,
  REJECTED_STATUSES,
  ROLES,
  SUPPORTED_PROVIDERS,
} from "../types";

/**
 * Mock mode's entire "backend" — no network, no Docker. Exists for
 * screenshots, portfolio preview, and UI work without the real ARIE stack
 * running (see README.md's "Mock mode" section). It reproduces the shape
 * and honesty of the real API (bounded progress, real optimistic
 * concurrency and idempotency semantics on review decisions) but the
 * underlying data is fabricated from the two known demo identities plus a
 * generic template for anything else submitted.
 *
 * Persisted to localStorage (not just in-memory) so a browser refresh in
 * mock mode reconstructs state the same way "api" mode does from the real
 * backend — see `deriveStatus`, which is a pure function of elapsed wall
 * time since creation rather than a timer that a reload would lose.
 */

const STORAGE_KEY = "arie-web:mock-store:v1";

// --- Productization M3: ICP profiles, batches, usage (mock, in-memory) ----
//
// Not persisted to localStorage like the lead store above — a page reload
// resetting these is an acceptable simplification for mock mode, which
// exists for screenshots/demo/UI work, not for exercising cross-session
// durability (the real backend's integration suite already covers that).

const REFERENCE_ICP_CONFIG: ICPProfileConfig = {
  qualify_threshold: 65,
  reject_threshold: 55,
  employee_count_bands: [
    { min_employees: 1, max_employees: 10, points: 2 },
    { min_employees: 11, max_employees: 50, points: 10 },
    { min_employees: 51, max_employees: 200, points: 20 },
    { min_employees: 201, max_employees: 1000, points: 18 },
    { min_employees: 1001, max_employees: 1_000_000_000, points: 8 },
  ],
  industry_points: {
    software: 15,
    fintech: 15,
    healthtech: 13,
    ecommerce: 12,
    logistics: 8,
    manufacturing: 7,
    education: 5,
    nonprofit: 2,
  },
  seniority_points: { c_level: 20, vp: 18, director: 14, manager: 8, ic: 2 },
  function_points: {
    data: 15,
    engineering: 14,
    operations: 9,
    marketing: 5,
    sales: 5,
    finance: 4,
    other: 2,
  },
  buying_intent_weight: 20,
  trigger_event_weight: 10,
  target_geographies: [],
  disqualifier_enabled: true,
};

export interface MockCsvRow {
  email: string;
  full_name?: string;
  company_name?: string;
  company_domain?: string;
  title?: string;
}

// Stage boundaries, ms since creation -- purely cosmetic pacing so the
// processing states in the New Lead flow are visible rather than instant.
const STAGE_BOUNDS_MS = {
  NEW: 0,
  SCORING: 350,
  FETCHING_EVIDENCE: 850,
  INTEGRATING: 1400,
  DECISION: 1850,
  SETTLED: 2200,
} as const;

interface ProviderCallTemplate {
  provider: string;
  status: "success" | "miss" | "error" | "timeout";
  cost_usd: string;
  latency_ms: number;
  cache_hit: boolean;
}

interface EvidenceItemTemplate {
  field: string;
  source: string;
  confidence: number;
  contested: boolean;
}

type ScenarioKey = "autonomous" | "escalation";

interface ScenarioTemplate {
  key: ScenarioKey;
  finalStatus: Extract<LeadStatus, "AUTO_ROUTED" | "AWAITING_HUMAN">;
  recommendedAction: "auto_route" | "reject";
  autonomous: boolean;
  score: { value: number; lower: number; upper: number; confidence: number; tau: number };
  stopReasonCode: "confidence_reached" | "all_providers_called";
  providerCalls: ProviderCallTemplate[];
  evidenceItems: EvidenceItemTemplate[];
  unknownFields: string[];
}

const AUTONOMOUS_TEMPLATE: ScenarioTemplate = {
  key: "autonomous",
  finalStatus: "AUTO_ROUTED",
  recommendedAction: "auto_route",
  autonomous: true,
  score: { value: 78.4, lower: 68.0, upper: 91.5, confidence: 0.87, tau: 0.79 },
  stopReasonCode: "confidence_reached",
  providerCalls: [
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
  evidenceItems: [
    { field: "title_seniority", source: "contact_enrich", confidence: 0.9, contested: true },
    { field: "title_function", source: "contact_enrich", confidence: 0.88, contested: false },
    { field: "industry", source: "firmographics_basic", confidence: 0.88, contested: false },
    { field: "employee_count", source: "firmographics_basic", confidence: 0.85, contested: false },
  ],
  unknownFields: ["buying_intent", "recent_trigger_event", "disqualifying_flag"],
};

const ESCALATION_TEMPLATE: ScenarioTemplate = {
  key: "escalation",
  finalStatus: "AWAITING_HUMAN",
  recommendedAction: "reject",
  autonomous: false,
  score: { value: 51.0, lower: 49.5, upper: 52.5, confidence: 0.42, tau: 0.8 },
  stopReasonCode: "all_providers_called",
  providerCalls: [
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
      latency_ms: 18,
      cache_hit: false,
    },
    {
      provider: "dns_web",
      status: "success",
      cost_usd: "0.0008",
      latency_ms: 260,
      cache_hit: false,
    },
    {
      provider: "firmographics_basic",
      status: "success",
      cost_usd: "0.0120",
      latency_ms: 330,
      cache_hit: false,
    },
    {
      provider: "contact_enrich",
      status: "success",
      cost_usd: "0.0550",
      latency_ms: 510,
      cache_hit: false,
    },
    {
      provider: "firmographics_premium",
      status: "success",
      cost_usd: "0.0900",
      latency_ms: 640,
      cache_hit: false,
    },
    {
      provider: "intent_signals",
      status: "success",
      cost_usd: "0.2500",
      latency_ms: 1180,
      cache_hit: false,
    },
    {
      provider: "deep_research",
      status: "success",
      cost_usd: "0.6000",
      latency_ms: 4300,
      cache_hit: false,
    },
  ],
  evidenceItems: [
    { field: "title_seniority", source: "inbound_payload", confidence: 0.65, contested: true },
    { field: "title_function", source: "contact_enrich", confidence: 0.75, contested: false },
    { field: "industry", source: "firmographics_premium", confidence: 0.91, contested: false },
    {
      field: "employee_count",
      source: "firmographics_premium",
      confidence: 0.88,
      contested: false,
    },
    { field: "buying_intent", source: "intent_signals", confidence: 0.55, contested: false },
    { field: "recent_trigger_event", source: "deep_research", confidence: 0.7, contested: false },
    { field: "disqualifying_flag", source: "deep_research", confidence: 0.6, contested: false },
  ],
  unknownFields: [],
};

const KNOWN_EMAILS: Record<string, ScenarioTemplate> = {
  "nadia.delacroix@lumen500.com": AUTONOMOUS_TEMPLATE,
  "nadia.haddad@cobalt500.com": ESCALATION_TEMPLATE,
};

function templateForEmail(email: string): ScenarioTemplate {
  const known = KNOWN_EMAILS[email.trim().toLowerCase()];
  if (known) return known;
  // Any other address still demonstrates a full run -- deterministic per
  // email (not random) so repeated submissions of the same test address
  // behave consistently within a session.
  let hash = 0;
  for (let i = 0; i < email.length; i += 1) hash = (hash * 31 + email.charCodeAt(i)) >>> 0;
  return hash % 2 === 0 ? AUTONOMOUS_TEMPLATE : ESCALATION_TEMPLATE;
}

interface ReviewRecord {
  review_id: string;
  reviewer: string | null;
  original_decision: string;
  final_decision: string | null;
  notes: string | null;
  responded_at: string | null;
  requested_at: string;
}

interface MockLead {
  lead_id: string;
  source: string;
  email: string;
  full_name: string | null;
  company_domain: string | null;
  company_name: string | null;
  external_ref: string | null;
  budget_usd_cap: string;
  company_id: string;
  person_id: string;
  version: number;
  created_at: string;
  createdAtMs: number;
  status: LeadStatus;
  scenario: ScenarioTemplate;
  review: ReviewRecord | null;
  isShadow: boolean;
}

interface StoreShape {
  leadsById: Record<string, MockLead>;
  leadIdByExternalKey: Record<string, string>;
  reviewIdToLeadId: Record<string, string>;
}

function emptyStore(): StoreShape {
  return { leadsById: {}, leadIdByExternalKey: {}, reviewIdToLeadId: {} };
}

function loadStore(): StoreShape {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as StoreShape;
    return {
      leadsById: parsed.leadsById ?? {},
      leadIdByExternalKey: parsed.leadIdByExternalKey ?? {},
      reviewIdToLeadId: parsed.reviewIdToLeadId ?? {},
    };
  } catch {
    return emptyStore();
  }
}

function saveStore(store: StoreShape): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function externalKey(source: string, externalRef: string | null | undefined): string | null {
  if (!externalRef) return null;
  return `${source}::${externalRef}`;
}

/** Purely a function of elapsed time -- refresh-safe, no timers to lose. */
function deriveStatus(lead: MockLead, nowMs: number): LeadStatus {
  const elapsed = nowMs - lead.createdAtMs;
  if (elapsed >= STAGE_BOUNDS_MS.SETTLED) {
    // Shadow mode is fixed at creation and never opens a review or takes an
    // authoritative routing action, regardless of which scenario's evidence
    // it reuses -- see IngestLeadRequest.mode's own doc comment.
    if (lead.isShadow) return "SHADOW_EVALUATED";
    if (lead.review) {
      return lead.review.final_decision
        ? statusForFinalDecision(lead.review.final_decision)
        : lead.scenario.finalStatus;
    }
    return lead.scenario.finalStatus;
  }
  if (elapsed >= STAGE_BOUNDS_MS.DECISION) return "DECISION";
  if (elapsed >= STAGE_BOUNDS_MS.INTEGRATING) return "INTEGRATING";
  if (elapsed >= STAGE_BOUNDS_MS.FETCHING_EVIDENCE) return "FETCHING_EVIDENCE";
  if (elapsed >= STAGE_BOUNDS_MS.SCORING) return "SCORING";
  return "NEW";
}

function statusForFinalDecision(finalDecision: string): LeadStatus {
  if (finalDecision === "auto_route") return "AUTO_ROUTED";
  if (finalDecision === "manual_review") return "MANUAL_REVIEW";
  return "SYNCED"; // "reject"
}

function isSettled(lead: MockLead, nowMs: number): boolean {
  return nowMs - lead.createdAtMs >= STAGE_BOUNDS_MS.SETTLED;
}

// ------------------------------------------------------- M7 Slice 4 mock --
//
// Mirrors `arie.recommendations`' deterministic rules closely enough for a
// demo — never imported from a shared module, because the real rules live
// once, on the backend; this is mock mode's own restatement, kept small.

const FIELD_LABELS: Record<string, string> = {
  employee_count: "company size",
  industry: "industry",
  title_seniority: "contact seniority",
  title_function: "contact function",
  buying_intent: "buying intent",
  recent_trigger_event: "a recent trigger event",
  disqualifying_flag: "a disqualifying condition",
};

function deriveRecommendation(receipt: ReceiptResponse): LeadRecommendationResponse {
  const known = receipt.evidence.items
    .filter((item) => item.field !== "disqualifying_flag")
    .map((item) => FIELD_LABELS[item.field] ?? item.field);
  const missing = receipt.evidence.unknown_fields.map((field) => FIELD_LABELS[field] ?? field);

  let priority: CustomerPriority;
  if (receipt.status !== "decided") {
    priority = "review";
  } else if (
    FAILURE_STATUSES.includes(receipt.lead_status) ||
    AWAITING_REVIEW_STATUSES.includes(receipt.lead_status)
  ) {
    priority = "review";
  } else if (REJECTED_STATUSES.includes(receipt.lead_status)) {
    priority = "skip";
  } else {
    const confidence = receipt.score?.confidence ?? 0;
    priority =
      receipt.decision?.recommended_action === "auto_route" && confidence >= 0.75
        ? "contact_first"
        : "worth_pursuing";
  }

  const hasDecisionMakerContact = !receipt.evidence.unknown_fields.includes("title_seniority");
  let nextAction: NextAction;
  if (receipt.status !== "decided") {
    nextAction = "research_more";
  } else if (FAILURE_STATUSES.includes(receipt.lead_status)) {
    nextAction = "human_review";
  } else if (AWAITING_REVIEW_STATUSES.includes(receipt.lead_status)) {
    nextAction = "human_review";
  } else if (priority === "skip") {
    nextAction = "skip";
  } else if (priority === "contact_first") {
    nextAction = hasDecisionMakerContact ? "contact_now" : "find_decision_maker";
  } else if (priority === "worth_pursuing") {
    nextAction = !hasDecisionMakerContact
      ? "find_decision_maker"
      : missing.length > 0
        ? "email_first"
        : "nurture";
  } else {
    nextAction = "research_more";
  }

  let shortReason: string;
  if (receipt.status !== "decided") {
    shortReason = "ARIE is still gathering evidence on this lead.";
  } else if (AWAITING_REVIEW_STATUSES.includes(receipt.lead_status)) {
    shortReason = "This lead is waiting on a human review before it can move forward.";
  } else if (priority === "skip") {
    shortReason = "This lead falls outside your targeting profile.";
  } else {
    const strength = priority === "contact_first" ? "Strong match" : "Possible match";
    shortReason =
      known.length > 0
        ? `${strength} based on ${known.slice(0, 3).join(", ")}.`
        : `${strength}, though little evidence has been gathered yet.`;
    if (missing.length > 0) shortReason += ` ${capitalize(missing[0])} is still unknown.`;
  }

  const confidenceBand: ConfidenceBand | null =
    receipt.score === null
      ? null
      : receipt.score.confidence >= 0.75
        ? "high"
        : receipt.score.confidence >= 0.45
          ? "medium"
          : "low";

  return {
    lead_id: receipt.lead_id,
    priority,
    next_action: nextAction,
    machine_decision: receipt.decision?.recommended_action ?? null,
    score: receipt.score?.value ?? null,
    confidence: receipt.score?.confidence ?? null,
    confidence_band: confidenceBand,
    short_reason: shortReason,
    key_evidence: known,
    missing_information: missing,
    research_status:
      receipt.status !== "decided"
        ? "not_performed"
        : receipt.providers.called.length === 0
          ? "not_performed"
          : "researched",
    explanation_status: "not_requested",
    profile_version: receipt.versions?.icp_profile_version ?? null,
    shadow: receipt.shadow,
    execution_mode: "simulated",
  };
}

function capitalize(text: string): string {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}

// ------------------------------------------------------- M7 Slice 5 mock --
//
// Mirrors `arie.research`'s materiality rules closely enough for a demo —
// see `deriveRecommendation`'s own note above about why this is never
// imported from a shared module. Both built-in demo identities (and every
// hashed fallback email, which reuses one of the two templates) already
// resolve all four Slice-5 candidate fields, so a plan for them always comes
// back `decision_already_clear` or `field_already_known` — an honest
// reflection of the fixed demo data, not a bug. See the M7 Slice 5 handoff's
// "Known limitations" for why this mock never actually persists a new field.

const RESEARCH_FIELD_CEILINGS: Record<ResearchTargetField, number> = {
  employee_count: 20,
  industry: 15,
  title_seniority: 20,
  title_function: 15,
};

const RESEARCH_DETERMINISTIC_QUESTIONS: Record<ResearchTargetField, string> = {
  employee_count: "Approximately how many employees does this company have?",
  industry: "What industry does this company operate in?",
  title_seniority: "How senior is this contact within their organization?",
  title_function: "What functional area does this contact work in?",
};

function deriveResearchPlan(receipt: ReceiptResponse): ResearchPlanResponse {
  const refused = (
    reason_code: ResearchReasonCode,
    detail: string,
    decisionAlreadyClear = false,
  ): ResearchPlanResponse => ({
    target_field: null,
    question: null,
    rationale: null,
    materiality: null,
    decision_already_clear: decisionAlreadyClear,
    candidate_sources: [],
    estimated_cost_usd: null,
    reason_code,
    detail,
    approved: false,
    llm_used: false,
  });

  if (receipt.status !== "decided" || !receipt.score) {
    return refused("no_research_needed", "ARIE hasn't finished evaluating this lead yet.");
  }
  const { value, threshold_qualify, threshold_reject, bounds } = receipt.score;
  const alreadyClear =
    bounds.lower >= threshold_qualify ||
    bounds.upper < threshold_reject ||
    (bounds.lower >= threshold_reject && bounds.upper < threshold_qualify);
  if (alreadyClear) {
    return refused(
      "decision_already_clear",
      "Given everything already known, no additional fact could change this recommendation.",
      true,
    );
  }

  const known = new Set(receipt.evidence.items.map((item) => item.field));
  const candidates = (Object.keys(RESEARCH_FIELD_CEILINGS) as ResearchTargetField[])
    .filter((field) => !known.has(field))
    .map((field) => ({ field, ceiling: RESEARCH_FIELD_CEILINGS[field] }))
    .filter(({ ceiling }) => {
      const bestCase = value + ceiling;
      return (
        (value < threshold_reject && bestCase >= threshold_reject) ||
        (value < threshold_qualify && bestCase >= threshold_qualify)
      );
    })
    .sort((a, b) => b.ceiling - a.ceiling);

  if (candidates.length === 0) {
    return refused(
      "no_useful_question",
      "No supported field could change this recommendation right now.",
    );
  }
  const target = candidates[0].field;
  return {
    target_field: target,
    question: RESEARCH_DETERMINISTIC_QUESTIONS[target],
    rationale: "The largest-impact missing field.",
    materiality: "material",
    decision_already_clear: false,
    candidate_sources: ["mock-source"],
    estimated_cost_usd: "0.0100",
    reason_code: "research_approved",
    detail: "Research is available for this lead.",
    approved: true,
    llm_used: false,
  };
}

const MOCK_USER_ID = "mock-user";
const MOCK_ORG_ID = "mock-org";

function defaultICPProfiles(): ICPProfile[] {
  return [
    {
      profile_id: "mock-icp-1",
      organization_id: MOCK_ORG_ID,
      version: 1,
      name: "Reference ICP",
      config: REFERENCE_ICP_CONFIG,
      scorer_version: "icp-1.0.0",
      status: "active",
      created_by_user_id: null,
      created_at: new Date(0).toISOString(),
      activated_at: new Date(0).toISOString(),
      retired_at: null,
    },
  ];
}

function defaultOrganization(): OrganizationResponse {
  return {
    organization_id: MOCK_ORG_ID,
    name: "Acme Revenue Team",
    slug: "acme-revenue-team",
    status: "active",
    timezone: "America/New_York",
    company_domain: "acme.example",
    onboarding_completed_at: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };
}

// The mock's "current user" is an admin, not the owner — deliberately, so
// the last-owner protection below is actually exercisable. Self can never
// act on its own membership (`CannotActOnSelfError`), so if self were the
// sole owner, the last-owner guard would be permanently unreachable from
// this store's public surface.
function defaultMembers(): MemberResponse[] {
  return [
    {
      organization_id: MOCK_ORG_ID,
      user_id: MOCK_USER_ID,
      role: "admin",
      status: "active",
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    },
    {
      organization_id: MOCK_ORG_ID,
      user_id: "mock-owner",
      role: "owner",
      status: "active",
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    },
    {
      organization_id: MOCK_ORG_ID,
      user_id: "mock-analyst",
      role: "analyst_reviewer",
      status: "active",
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    },
  ];
}

function defaultProviders(): Record<ProviderId, ProviderStatusResponse> {
  return Object.fromEntries(
    SUPPORTED_PROVIDERS.map((provider) => [
      provider,
      {
        provider,
        configured: false,
        enabled: false,
        updated_at: null,
        last_tested_at: null,
        last_test_status: null,
        last_test_error: null,
      },
    ]),
  ) as Record<ProviderId, ProviderStatusResponse>;
}

class MockArieStore {
  private store: StoreShape | null = null;
  private icpProfiles: ICPProfile[] = defaultICPProfiles();
  private batches: Batch[] = [];
  private batchRows = new Map<string, BatchRow[]>();
  /** M7 Slice 4. In-memory only (not persisted to `localStorage` like the
   * lead store above) — a demo-mode opinion surviving a refresh isn't worth
   * the added persistence surface. */
  private feedback = new Map<string, FeedbackResponse>();

  // --- Productization M4: organization, members, invitations, providers,
  // onboarding, limits (mock, in-memory) --------------------------------
  //
  // Mock mode has no real Supabase session (see ICPPage's docstring) — every
  // action below is treated as permitted, matching every other mock-mode
  // screen's "no auth wall" behaviour. All reset to their `defaultX()` value
  // by `resetForTests()`, same as `store`/`icpProfiles`/`batches` above.

  private readonly mockUserId = MOCK_USER_ID;
  private readonly mockOrgId = MOCK_ORG_ID;

  private organization: OrganizationResponse = defaultOrganization();
  private members: MemberResponse[] = defaultMembers();
  private invitations: InvitationResponse[] = [];
  private providers: Record<ProviderId, ProviderStatusResponse> = defaultProviders();

  private get(): StoreShape {
    if (!this.store) this.store = loadStore();
    return this.store;
  }

  private persist(): void {
    if (this.store) saveStore(this.store);
  }

  /** Drops the in-memory cache so the next call reloads from (now-cleared)
   * localStorage, and resets every other piece of mutable state back to its
   * constructor-time default. Exists for test isolation between cases in
   * the same module instance — `vi.resetModules()` would otherwise also
   * reset the error classes tests import statically, breaking `instanceof`
   * checks. */
  resetForTests(): void {
    this.store = null;
    this.icpProfiles = defaultICPProfiles();
    this.batches = [];
    this.batchRows = new Map();
    this.feedback = new Map();
    this.organization = defaultOrganization();
    this.members = defaultMembers();
    this.invitations = [];
    this.invitationTokens = new Map();
    this.providers = defaultProviders();
  }

  createLead(input: IngestLeadRequest): IngestLeadResponse {
    if (!input.email || input.email.trim().length < 3) {
      throw new ArieValidationError("email must be at least 3 characters");
    }
    if (!input.source || input.source.trim().length === 0) {
      throw new ArieValidationError("source is required");
    }

    const store = this.get();
    const key = externalKey(input.source, input.external_ref);
    if (key && store.leadIdByExternalKey[key]) {
      const existing = store.leadsById[store.leadIdByExternalKey[key]];
      return {
        lead_id: existing.lead_id,
        status: deriveStatus(existing, Date.now()),
        created: false,
        company_id: existing.company_id,
        person_id: existing.person_id,
        job_id: crypto.randomUUID(),
        job_created: false,
        job_requeued: false,
        is_shadow: existing.isShadow,
      };
    }

    const now = Date.now();
    const lead: MockLead = {
      lead_id: crypto.randomUUID(),
      source: input.source,
      email: input.email,
      full_name: input.full_name ?? null,
      company_domain: input.company_domain ?? null,
      company_name: input.company_name ?? null,
      external_ref: input.external_ref ?? null,
      budget_usd_cap: input.budget_usd_cap ?? "1.50",
      company_id: crypto.randomUUID(),
      person_id: crypto.randomUUID(),
      version: 1,
      created_at: new Date(now).toISOString(),
      createdAtMs: now,
      status: "NEW",
      scenario: templateForEmail(input.email),
      review: null,
      isShadow: input.mode === "shadow",
    };

    store.leadsById[lead.lead_id] = lead;
    if (key) store.leadIdByExternalKey[key] = lead.lead_id;
    this.persist();

    return {
      lead_id: lead.lead_id,
      status: "NEW",
      created: true,
      company_id: lead.company_id,
      person_id: lead.person_id,
      job_id: crypto.randomUUID(),
      job_created: true,
      job_requeued: false,
      is_shadow: lead.isShadow,
    };
  }

  private requireLead(leadId: string): MockLead {
    const lead = this.get().leadsById[leadId];
    if (!lead) throw new ArieNotFoundError(`no lead ${leadId}`);
    return lead;
  }

  private maybeOpenReview(lead: MockLead, nowMs: number): void {
    if (lead.isShadow) return;
    if (lead.review) return;
    if (lead.scenario.finalStatus !== "AWAITING_HUMAN") return;
    if (!isSettled(lead, nowMs)) return;
    lead.review = {
      review_id: crypto.randomUUID(),
      reviewer: null,
      original_decision: lead.scenario.recommendedAction,
      final_decision: null,
      notes: null,
      responded_at: null,
      requested_at: new Date(nowMs).toISOString(),
    };
    this.get().reviewIdToLeadId[lead.review.review_id] = lead.lead_id;
  }

  getLead(leadId: string): LeadResponse {
    const lead = this.requireLead(leadId);
    const now = Date.now();
    this.maybeOpenReview(lead, now);
    const status = deriveStatus(lead, now);
    lead.status = status;
    this.persist();

    const settled = isSettled(lead, now);
    const providerCost = settled ? sumCosts(lead.scenario.providerCalls) : "0.0000";

    return {
      lead_id: lead.lead_id,
      status,
      version: lead.version,
      source: lead.source,
      external_ref: lead.external_ref,
      company_id: lead.company_id,
      person_id: lead.person_id,
      budget_usd_cap: lead.budget_usd_cap,
      is_shadow: lead.isShadow,
      created_at: lead.created_at,
      updated_at: new Date(now).toISOString(),
      cost: {
        provider_cost_usd: providerCost,
        model_cost_usd: "0.0000",
        total_cost_usd: providerCost,
        provider_calls: settled
          ? lead.scenario.providerCalls.filter((c) => !c.cache_hit).length
          : 0,
        cache_hits: 0,
        provider_latency_ms: settled
          ? lead.scenario.providerCalls.reduce((sum, c) => sum + c.latency_ms, 0)
          : 0,
      },
    };
  }

  getReceipt(leadId: string): ReceiptResponse {
    const lead = this.requireLead(leadId);
    const now = Date.now();
    this.maybeOpenReview(lead, now);
    const status = deriveStatus(lead, now);
    const settled = isSettled(lead, now);
    const providerCost = settled ? sumCosts(lead.scenario.providerCalls) : "0.0000";

    if (!settled) {
      return {
        receipt_version: "1",
        lead_id: lead.lead_id,
        status: "pending",
        lead_status: status,
        created_at: null,
        shadow: lead.isShadow,
        decision: null,
        score: null,
        stopping: null,
        versions: null,
        cost: {
          provider_cost_usd: "0.0000",
          model_cost_usd: "0.0000",
          total_cost_usd: "0.0000",
          budget_usd_cap: lead.budget_usd_cap,
        },
        evidence: { cache_hits: 0, provider_calls: 0, items: [], unknown_fields: [] },
        providers: { called: [], not_called: [...ALL_PROVIDER_NAMES] },
        human_review: null,
      };
    }

    const finalStatus = deriveStatus(lead, now);
    const humanOverride = Boolean(
      lead.review?.final_decision && lead.review.final_decision !== lead.review.original_decision,
    );

    return {
      receipt_version: "1",
      lead_id: lead.lead_id,
      status: "decided",
      lead_status: finalStatus,
      created_at: new Date(lead.createdAtMs + STAGE_BOUNDS_MS.SETTLED).toISOString(),
      shadow: lead.isShadow,
      decision: {
        recommended_action: lead.scenario.recommendedAction,
        autonomous: lead.scenario.autonomous,
        final_status: finalStatus,
        human_override: humanOverride,
      },
      score: {
        value: lead.scenario.score.value,
        threshold_qualify: 65.0,
        threshold_reject: 55.0,
        bounds: { lower: lead.scenario.score.lower, upper: lead.scenario.score.upper },
        confidence: lead.scenario.score.confidence,
        tau: lead.scenario.score.tau,
      },
      stopping: {
        reason_code: lead.scenario.stopReasonCode,
        explanation: explanationFor(lead.scenario.stopReasonCode),
      },
      versions: {
        policy: "calibrated_bounds",
        scorer: "icp-1.0.0",
        confidence_calibration: "platt",
        // Mock mode predates organization ICP profiles — always the
        // reference config, so there is no profile id to name.
        icp_profile_id: null,
        icp_profile_version: null,
      },
      cost: {
        provider_cost_usd: providerCost,
        model_cost_usd: "0.0000",
        total_cost_usd: providerCost,
        budget_usd_cap: lead.budget_usd_cap,
      },
      evidence: {
        cache_hits: 0,
        provider_calls: lead.scenario.providerCalls.filter((c) => !c.cache_hit).length,
        items: lead.scenario.evidenceItems,
        unknown_fields: lead.scenario.unknownFields,
      },
      providers: {
        called: lead.scenario.providerCalls,
        not_called: ALL_PROVIDER_NAMES.filter(
          (name) => !lead.scenario.providerCalls.some((c) => c.provider === name),
        ),
      },
      human_review: lead.review
        ? {
            review_id: lead.review.review_id,
            required: true,
            reviewer: lead.review.reviewer,
            original_decision: lead.review.original_decision,
            action: actionForFinalDecision(lead.review.final_decision),
            final_decision: lead.review.final_decision,
            responded_at: lead.review.responded_at,
          }
        : null,
    };
  }

  // ------------------------------------------------- M7 Slice 4: mock only --

  getRecommendation(leadId: string): LeadRecommendationResponse {
    return deriveRecommendation(this.getReceipt(leadId));
  }

  getExplanation(leadId: string): LeadExplanationResponse {
    const recommendation = this.getRecommendation(leadId);
    return {
      summary: recommendation.short_reason,
      claims: recommendation.key_evidence.slice(0, 3).map((label) => ({
        text: `${capitalize(label)} matches your targeting profile.`,
        evidence_ids: [],
        hypothesis: false,
      })),
      missing_information: recommendation.missing_information,
      hypothesis_notes: [],
      // Mock mode never calls a model — see this file's own docstring.
      source: "deterministic",
      unavailable_reason: null,
    };
  }

  submitFeedback(leadId: string, request: SubmitFeedbackRequest): FeedbackResponse {
    this.requireLead(leadId);
    const recommendation = this.getRecommendation(leadId);
    const now = new Date().toISOString();
    const existing = this.feedback.get(leadId);
    const record: FeedbackResponse = {
      feedback_id: existing?.feedback_id ?? crypto.randomUUID(),
      lead_id: leadId,
      profile_version: recommendation.profile_version,
      recommendation_priority: recommendation.priority,
      recommendation_next_action: recommendation.next_action,
      sentiment: request.sentiment,
      reason: request.reason ?? null,
      note: request.note ?? null,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };
    this.feedback.set(leadId, record);
    return record;
  }

  getFeedback(leadId: string): FeedbackResponse | null {
    this.requireLead(leadId);
    return this.feedback.get(leadId) ?? null;
  }

  // -------------------------------------------------- M7 Slice 5: mock only --

  getResearchPlan(leadId: string): ResearchPlanResponse {
    return deriveResearchPlan(this.getReceipt(leadId));
  }

  /** Never actually persists a new field — see `deriveResearchPlan`'s own
   * note on why the two built-in demo identities never produce an approved
   * plan in the first place. Kept for API-shape completeness and for a
   * custom identity a future template might make borderline. */
  executeResearch(leadId: string, request: ExecuteResearchRequest): ResearchExecutionResponse {
    const plan = this.getResearchPlan(leadId);
    if (!plan.approved || plan.target_field !== request.target_field) {
      const reasonCode: ResearchReasonCode = plan.approved
        ? "missing_field_cannot_change_decision"
        : plan.reason_code;
      return {
        approved: false,
        reason_code: reasonCode,
        detail: plan.detail,
        target_field: request.target_field,
        provider: null,
        found_value: null,
        cost_usd: "0.0000",
        preview: null,
      };
    }
    const receipt = this.getReceipt(leadId);
    const score = receipt.score;
    return {
      approved: true,
      reason_code: "research_approved",
      detail: "New information was found and added to this lead's evidence.",
      target_field: request.target_field,
      provider: "mock-source",
      found_value: null,
      cost_usd: plan.estimated_cost_usd ?? "0.0000",
      preview: score
        ? {
            score: score.value,
            bounds_lower: score.bounds.lower,
            bounds_upper: score.bounds.upper,
            likely_outcome:
              score.value >= score.threshold_qualify
                ? "qualifies"
                : score.value < score.threshold_reject
                  ? "rejects"
                  : "borderline",
          }
        : null,
    };
  }

  // -------------------------------------------------- M7 Slice 6: mock only --
  //
  // Deterministic, keyword-based — the same intent recognizer the backend's
  // `arie.copilot.recognize_list_intent`/`recognize_lead_intent` apply, kept
  // narrow rather than reimplementing the LLM classification fallback: mock
  // mode never calls a model, so an unmatched question always degrades to
  // the same controlled "couldn't interpret" answer a real budget-exhausted
  // or unavailable-provider response would.

  askCopilot(question: string): CopilotResponse {
    const q = question.trim().toLowerCase();
    const leads = Object.values(this.get().leadsById).map((lead) => ({
      lead,
      recommendation: this.getRecommendation(lead.lead_id),
    }));

    let intent: CopilotIntent | null = null;
    let matched = leads;

    if (/work on today|what should i (work|do)/.test(q)) {
      intent = "work_today";
      const rank: Record<CustomerPriority, number> = {
        contact_first: 0,
        worth_pursuing: 1,
        review: 2,
        skip: 3,
      };
      matched = leads
        .filter((entry) => entry.recommendation.priority !== "skip")
        .sort((a, b) => rank[a.recommendation.priority] - rank[b.recommendation.priority]);
    } else if (/need(s)? (more )?research/.test(q)) {
      intent = "needs_research";
      matched = leads.filter((entry) => entry.recommendation.next_action === "research_more");
    } else if (/decision.?maker/.test(q)) {
      intent = "missing_decision_maker";
      matched = leads.filter((entry) => entry.recommendation.next_action === "find_decision_maker");
    } else if (/low confidence/.test(q)) {
      intent = "low_confidence";
      matched = leads.filter((entry) => entry.recommendation.confidence_band === "low");
    } else if (/feedback|disliked|bad recommendation/.test(q)) {
      intent = "feedback_summary";
      matched = leads.filter((entry) => this.feedback.has(entry.lead.lead_id));
    } else if (/top \d*\s*leads?|best leads?/.test(q)) {
      intent = "top_leads";
    }

    if (intent === null) {
      return {
        answer:
          "Ask ARIE can help with your leads, targeting, and recommendations — try asking for " +
          "your top leads, leads needing research, or what to work on today.",
        leads: [],
        intent: "filter_leads",
        result_count: 0,
        filters_applied: {},
        llm_used: false,
      };
    }

    const references: CopilotLeadReference[] = matched
      .slice(0, 20)
      .map(({ lead, recommendation }) => ({
        lead_id: lead.lead_id,
        company: lead.company_name,
        contact: lead.full_name,
        priority: recommendation.priority,
        score: recommendation.score,
        why: recommendation.short_reason,
        next_action: recommendation.next_action,
      }));

    return {
      answer:
        references.length > 0
          ? `Found ${references.length} matching lead${references.length === 1 ? "" : "s"}.`
          : "No leads matched that question right now.",
      leads: references,
      intent,
      result_count: references.length,
      filters_applied: {},
      llm_used: false,
    };
  }

  askLeadCopilot(leadId: string, question: string): LeadCopilotResponse {
    this.requireLead(leadId);
    const recommendation = this.getRecommendation(leadId);
    const q = question.trim().toLowerCase();

    if (/missing/.test(q)) {
      return {
        lead_id: leadId,
        intent: "lead_missing_info",
        answer:
          recommendation.missing_information.length > 0
            ? `Still unknown: ${recommendation.missing_information.join(", ")}.`
            : "Nothing material is missing — ARIE has everything it needs for this recommendation.",
        missing_information: recommendation.missing_information,
        researchable_field: null,
      };
    }
    if (/research/.test(q) && /(help|worth|would.*change)/.test(q)) {
      const plan = this.getResearchPlan(leadId);
      return {
        lead_id: leadId,
        intent: "lead_researchability",
        answer: plan.approved
          ? `Yes. ${plan.question ?? "This question"} could materially change this recommendation.`
          : `No. ${plan.detail}`,
        missing_information: [],
        researchable_field: plan.target_field,
      };
    }
    if (/what would (need to )?change|become contact first|improve/.test(q)) {
      return {
        lead_id: leadId,
        intent: "lead_improvement_path",
        answer:
          recommendation.missing_information.length > 0
            ? `Confirming ${recommendation.missing_information[0]} could materially change this ` +
              "recommendation, though other factors may still affect the final outcome."
            : "Given everything already known, no additional fact would change this recommendation.",
        missing_information: recommendation.missing_information,
        researchable_field: null,
      };
    }
    if (/affect|score driver|drove the score|what.*score/.test(q)) {
      return {
        lead_id: leadId,
        intent: "lead_score_drivers",
        answer:
          recommendation.key_evidence.length > 0
            ? `Positive: ${recommendation.key_evidence.join(", ")}.`
            : "No scored evidence has been collected for this lead yet.",
        missing_information: recommendation.missing_information,
        researchable_field: null,
      };
    }
    return {
      lead_id: leadId,
      intent: "lead_explanation",
      answer: recommendation.short_reason,
      missing_information: recommendation.missing_information,
      researchable_field: null,
    };
  }

  getReview(reviewId: string): ReviewResponse {
    const store = this.get();
    const leadId = store.reviewIdToLeadId[reviewId];
    if (!leadId) throw new ArieNotFoundError(`no review ${reviewId}`);
    const lead = this.requireLead(leadId);
    const review = lead.review;
    if (!review) throw new ArieNotFoundError(`no review ${reviewId}`);
    const now = Date.now();
    const status = deriveStatus(lead, now);

    return {
      review_id: review.review_id,
      lead_id: lead.lead_id,
      requested_at: review.requested_at,
      reviewer: review.reviewer,
      original_decision: review.original_decision,
      final_decision: review.final_decision,
      notes: review.notes,
      responded_at: review.responded_at,
      is_pending: review.responded_at === null,
      lead_status: status,
      lead_version: lead.version,
    };
  }

  submitReviewDecision(reviewId: string, request: ReviewDecisionRequest): ReviewDecisionResponse {
    const store = this.get();
    const leadId = store.reviewIdToLeadId[reviewId];
    if (!leadId) throw new ArieNotFoundError(`no review ${reviewId}`);
    const lead = this.requireLead(leadId);
    const review = lead.review;
    if (!review) throw new ArieNotFoundError(`no review ${reviewId}`);

    if (request.action === "edit" && !(request.notes && request.notes.trim())) {
      throw new ArieValidationError(
        "action 'edit' requires non-empty notes explaining the override",
      );
    }

    const finalDecision = FINAL_DECISION_FOR_ACTION[request.action];

    if (review.responded_at !== null) {
      const identical =
        review.final_decision === finalDecision &&
        review.reviewer === request.reviewer &&
        review.notes === (request.notes ?? null);
      if (identical) {
        return {
          review_id: review.review_id,
          lead_id: lead.lead_id,
          action: request.action,
          final_decision: finalDecision,
          reviewer: review.reviewer ?? request.reviewer,
          notes: review.notes,
          responded_at: review.responded_at,
          lead_status: lead.status,
          lead_version: lead.version,
          already_applied: true,
        };
      }
      throw new ArieConflictError(
        `review ${reviewId} was already decided differently — refusing to overwrite`,
      );
    }

    if (request.expected_lead_version !== lead.version) {
      throw new ArieConflictError(
        `lead ${lead.lead_id} version conflict: expected ${request.expected_lead_version}, was ${lead.version}`,
      );
    }

    const now = Date.now();
    review.reviewer = request.reviewer;
    review.final_decision = finalDecision;
    review.notes = request.notes ?? null;
    review.responded_at = new Date(now).toISOString();
    lead.version += 1;
    lead.status = statusForFinalDecision(finalDecision);
    this.persist();

    return {
      review_id: review.review_id,
      lead_id: lead.lead_id,
      action: request.action,
      final_decision: finalDecision,
      reviewer: request.reviewer,
      notes: review.notes,
      responded_at: review.responded_at,
      lead_status: lead.status,
      lead_version: lead.version,
      already_applied: false,
    };
  }

  getHealth(): HealthResponse {
    return { status: "ok", database: true, schema_ready: true };
  }

  // ------------------------------------------------------- ICP profiles --

  getActiveICPProfile(): ICPProfile {
    const active = this.icpProfiles.find((p) => p.status === "active");
    if (!active) throw new ArieNotFoundError("this organization has no active ICP profile");
    return active;
  }

  listICPVersions(): ICPProfile[] {
    return [...this.icpProfiles].sort((a, b) => b.version - a.version);
  }

  getICPVersion(version: number): ICPProfile {
    const found = this.icpProfiles.find((p) => p.version === version);
    if (!found) throw new ArieNotFoundError(`no ICP profile version ${version}`);
    return found;
  }

  createICPProfile(request: CreateICPProfileRequest): ICPProfile {
    if (!request.name.trim()) throw new ArieValidationError("name is required");
    const nextVersion = Math.max(0, ...this.icpProfiles.map((p) => p.version)) + 1;
    const now = new Date().toISOString();
    this.icpProfiles = this.icpProfiles.map((p) =>
      p.status === "active" ? { ...p, status: "retired" as const, retired_at: now } : p,
    );
    const created: ICPProfile = {
      profile_id: `mock-icp-${nextVersion}`,
      organization_id: "mock-org",
      version: nextVersion,
      name: request.name,
      config: request.config,
      scorer_version: "icp-1.0.0",
      status: "active",
      created_by_user_id: "mock-user",
      created_at: now,
      activated_at: now,
      retired_at: null,
    };
    this.icpProfiles = [...this.icpProfiles, created];
    return created;
  }

  // ------------------------------------------------------------ batches --

  uploadBatch(filename: string, rows: MockCsvRow[]): Batch {
    if (rows.length === 0) throw new ArieValidationError("file has no data rows");
    const batchId = `mock-batch-${Math.random().toString(36).slice(2, 10)}`;
    const records: BatchRow[] = rows.map((row, index) => {
      const valid = typeof row.email === "string" && row.email.includes("@");
      const leadId = valid ? `mock-lead-${batchId}-${index}` : null;
      return {
        batch_id: batchId,
        row_number: index + 1,
        raw_row: row as unknown as Record<string, string>,
        validation_status: valid ? "accepted" : "rejected",
        validation_error: valid ? null : "email is required or unrecognizable",
        lead_id: leadId,
        lead_status: valid ? "AUTO_ROUTED" : null,
        priority: valid ? "contact_first" : null,
        next_action: valid ? "contact_now" : null,
        short_reason: valid ? "Strong match based on your targeting profile." : null,
        confidence_band: valid ? "high" : null,
      };
    });
    const acceptedRows = records.filter((r) => r.validation_status === "accepted").length;
    const rejectedRows = records.length - acceptedRows;
    const providerCost = acceptedRows * 0.0016;

    const batch: Batch = {
      batch_id: batchId,
      organization_id: "mock-org",
      filename,
      total_rows: records.length,
      accepted_rows: acceptedRows,
      rejected_rows: rejectedRows,
      created_by_user_id: "mock-user",
      created_at: new Date().toISOString(),
      progress: {
        total_rows: records.length,
        accepted_rows: acceptedRows,
        rejected_rows: rejectedRows,
        processing_count: 0,
        qualified_count: acceptedRows,
        rejected_lead_count: 0,
        review_count: 0,
        failed_count: 0,
        provider_cost_usd: providerCost,
        model_cost_usd: 0,
        total_cost_usd: providerCost,
        is_complete: true,
      },
    };
    this.batchRows.set(batchId, records);
    this.batches = [batch, ...this.batches];
    return batch;
  }

  listBatches(): Batch[] {
    return this.batches;
  }

  getBatch(batchId: string): Batch {
    const found = this.batches.find((b) => b.batch_id === batchId);
    if (!found) throw new ArieNotFoundError(`no batch ${batchId}`);
    return found;
  }

  listBatchRows(batchId: string): BatchRowsPage {
    if (!this.batches.some((b) => b.batch_id === batchId)) {
      throw new ArieNotFoundError(`no batch ${batchId}`);
    }
    const rows = this.batchRows.get(batchId) ?? [];
    return { items: rows, limit: Math.max(rows.length, 1), offset: 0, total: rows.length };
  }

  // -------------------------------------------------------------- usage --

  getUsage(): UsageSummary {
    const now = new Date();
    const totals = this.batches.reduce(
      (acc, b) => ({
        leads: acc.leads + b.total_rows,
        qualified: acc.qualified + b.progress.qualified_count,
        rejected: acc.rejected + b.progress.rejected_lead_count,
        review: acc.review + b.progress.review_count,
        pending: acc.pending + b.progress.processing_count,
        failed: acc.failed + b.progress.failed_count,
        calls: acc.calls + b.accepted_rows,
        providerCost: acc.providerCost + b.progress.provider_cost_usd,
      }),
      {
        leads: 0,
        qualified: 0,
        rejected: 0,
        review: 0,
        pending: 0,
        failed: 0,
        calls: 0,
        providerCost: 0,
      },
    );
    return {
      from_at: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      to_at: now.toISOString(),
      leads_processed: totals.leads,
      qualified_count: totals.qualified,
      rejected_count: totals.rejected,
      review_count: totals.review,
      pending_count: totals.pending,
      failed_count: totals.failed,
      provider_calls: totals.calls,
      cache_hits: 0,
      provider_cost_usd: totals.providerCost,
      model_cost_usd: 0,
      total_cost_usd: totals.providerCost,
    };
  }

  // -------------------------------------------------------- organization --

  getOrganization(): OrganizationResponse {
    return this.organization;
  }

  updateOrganization(request: UpdateOrganizationRequest): OrganizationResponse {
    if (
      request.name === undefined &&
      request.timezone === undefined &&
      request.company_domain === undefined
    ) {
      throw new ArieValidationError("at least one field must be provided");
    }
    if (request.name !== undefined && !request.name.trim()) {
      throw new ArieValidationError("name must not be empty");
    }
    this.organization = {
      ...this.organization,
      ...(request.name !== undefined ? { name: request.name } : {}),
      ...(request.timezone !== undefined ? { timezone: request.timezone } : {}),
      ...(request.company_domain !== undefined ? { company_domain: request.company_domain } : {}),
      updated_at: new Date().toISOString(),
    };
    return this.organization;
  }

  // --------------------------------------------------------------- billing --
  //
  // Productization M6. Mock mode fabricates the same grandfathered,
  // always-entitled `plan='internal'` state the Legacy Organization gets in
  // production — see `getUsageAgainstLimits` above. There is no real Stripe
  // account behind this demo, so Checkout/Portal are not meaningfully
  // simulatable; `BillingPanel` never offers them for an `internal` plan
  // (same as it would in production), so these two are unreachable in
  // practice and exist only to satisfy the shared client interface.

  getBilling(): BillingResponse {
    const now = new Date().toISOString();
    return {
      billing: {
        organization_id: this.mockOrgId,
        stripe_customer_id: null,
        stripe_subscription_id: null,
        plan: "internal",
        status: "active",
        current_period_start: null,
        current_period_end: null,
        cancel_at_period_end: false,
        canceled_at: null,
        created_at: now,
        updated_at: now,
      },
      entitlements: {
        plan: "internal",
        max_leads_per_month: 5000,
        max_csv_rows_per_upload: 200,
        max_modeled_spend_usd_per_month: 50,
        max_members: 25,
        live_provider_feature_allowed: true,
      },
    };
  }

  startCheckout(): CheckoutSessionResponse {
    throw new ArieApiError("Billing checkout is not available in the demo.", 501);
  }

  openBillingPortal(): BillingPortalResponse {
    throw new ArieApiError("The billing portal is not available in the demo.", 501);
  }

  // ---------------------------------------------------------- provisioning --

  createOrganization(request: CreateOrganizationRequest): CreateOrganizationResponse {
    if (!request.name.trim()) throw new ArieValidationError("organization name must not be empty");
    return { organization_id: this.mockOrgId, slug: this.organization.slug };
  }

  // ------------------------------------------------------------- members --

  listMembers(): MemberResponse[] {
    return this.members.filter((m) => m.status === "active");
  }

  private countActiveOwners(): number {
    return this.members.filter((m) => m.status === "active" && m.role === "owner").length;
  }

  updateMemberRole(userId: string, request: UpdateMemberRoleRequest): MemberResponse {
    if (!ROLES.includes(request.role as (typeof ROLES)[number])) {
      throw new ArieValidationError(`unknown role '${request.role}'`);
    }
    if (userId === this.mockUserId) {
      throw new ArieConflictError("cannot change your own role");
    }
    const member = this.members.find((m) => m.user_id === userId && m.status === "active");
    if (!member) throw new ArieNotFoundError("member not found");
    if (member.role === "owner" && request.role !== "owner" && this.countActiveOwners() <= 1) {
      throw new ArieConflictError("cannot demote the organization's only remaining owner");
    }
    member.role = request.role;
    member.updated_at = new Date().toISOString();
    return member;
  }

  removeMember(userId: string): MemberResponse {
    if (userId === this.mockUserId) {
      throw new ArieConflictError("cannot remove yourself");
    }
    const member = this.members.find((m) => m.user_id === userId && m.status === "active");
    if (!member) throw new ArieNotFoundError("member not found");
    if (member.role === "owner" && this.countActiveOwners() <= 1) {
      throw new ArieConflictError("cannot remove the organization's only remaining owner");
    }
    member.status = "removed";
    member.updated_at = new Date().toISOString();
    return member;
  }

  // --------------------------------------------------------- invitations --
  //
  // Mirrors the backend's own "raw token shown once, only a hash persisted"
  // shape: `this.invitations` never carries `raw_token` past the moment
  // `createInvitation` returns it, matching `InvitationResponse`. This
  // separate map is the mock's stand-in for `token_hash` lookups.

  private invitationTokens = new Map<string, string>();

  listInvitations(): InvitationResponse[] {
    return [...this.invitations].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  createInvitation(request: CreateInvitationRequest): InvitationCreatedResponse {
    if (!ROLES.includes(request.role as (typeof ROLES)[number])) {
      throw new ArieValidationError(`unknown role '${request.role}'`);
    }
    const emailNormalized = request.email.trim().toLowerCase();
    if (!emailNormalized || !emailNormalized.includes("@")) {
      throw new ArieValidationError("email must be a valid address");
    }
    const duplicate = this.invitations.find(
      (i) => i.email_normalized === emailNormalized && i.status === "pending",
    );
    if (duplicate) {
      throw new ArieConflictError(`a pending invitation already exists for ${emailNormalized}`);
    }
    const now = new Date();
    const rawToken = `mock_${crypto.randomUUID().replace(/-/g, "")}`;
    const invitationId = crypto.randomUUID();
    const base: InvitationResponse = {
      invitation_id: invitationId,
      organization_id: this.mockOrgId,
      email_normalized: emailNormalized,
      role: request.role,
      status: "pending",
      invited_by_user_id: this.mockUserId,
      created_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      accepted_at: null,
      revoked_at: null,
      email_status: "sent",
      email_error: null,
      email_sent_at: now.toISOString(),
    };
    this.invitations = [...this.invitations, base];
    this.invitationTokens.set(invitationId, rawToken);
    return { ...base, raw_token: rawToken };
  }

  revokeInvitation(invitationId: string): InvitationResponse {
    const invitation = this.invitations.find(
      (i) => i.invitation_id === invitationId && i.status === "pending",
    );
    if (!invitation) throw new ArieNotFoundError("invitation not found");
    invitation.status = "revoked";
    invitation.revoked_at = new Date().toISOString();
    return invitation;
  }

  resendInvitation(invitationId: string): InvitationCreatedResponse {
    const invitation = this.invitations.find(
      (i) => i.invitation_id === invitationId && i.status === "pending",
    );
    if (!invitation) throw new ArieNotFoundError("no pending invitation with that id");
    this.revokeInvitation(invitationId);
    return this.createInvitation({ email: invitation.email_normalized, role: invitation.role });
  }

  /** Mock mode has no verified-identity flow to check an email against — it
   * accepts any live, pending token and creates a fabricated new member.
   * Expiry/replay are still honestly simulated since both are pure
   * functions of the invitation record. */
  acceptInvitation(request: AcceptInvitationRequest): InvitationResponse {
    const invitationId = [...this.invitationTokens.entries()].find(
      ([, token]) => token === request.token,
    )?.[0];
    const invitation = this.invitations.find(
      (i) => i.invitation_id === (invitationId ?? request.token),
    );
    if (!invitation || invitation.status !== "pending") {
      throw new ArieNotFoundError("invitation not found");
    }
    if (new Date(invitation.expires_at).getTime() < Date.now()) {
      invitation.status = "expired";
      throw new ArieApiError(`invitation ${invitation.invitation_id} has expired`, 410);
    }
    invitation.status = "accepted";
    invitation.accepted_at = new Date().toISOString();
    this.members = [
      ...this.members.filter((m) => m.user_id !== "mock-invited-user"),
      {
        organization_id: this.mockOrgId,
        user_id: "mock-invited-user",
        role: invitation.role,
        status: "active",
        created_at: invitation.accepted_at,
        updated_at: invitation.accepted_at,
      },
    ];
    return invitation;
  }

  // ----------------------------------------------------------- providers --

  listProviders(): ProviderStatusResponse[] {
    return SUPPORTED_PROVIDERS.map((provider) => this.providers[provider]);
  }

  private requireProvider(provider: string): ProviderId {
    if (!SUPPORTED_PROVIDERS.includes(provider as ProviderId)) {
      throw new ArieNotFoundError(`unknown provider '${provider}'`);
    }
    return provider as ProviderId;
  }

  getProvider(provider: string): ProviderStatusResponse {
    return this.providers[this.requireProvider(provider)];
  }

  setProviderCredential(
    provider: string,
    request: SetProviderCredentialRequest,
  ): ProviderStatusResponse {
    const id = this.requireProvider(provider);
    if (!request.credential.trim()) throw new ArieValidationError("credential must not be empty");
    this.providers[id] = {
      ...this.providers[id],
      configured: true,
      enabled: true,
      updated_at: new Date().toISOString(),
      last_tested_at: null,
      last_test_status: null,
      last_test_error: null,
    };
    return this.providers[id];
  }

  setProviderEnabled(provider: string, request: SetProviderEnabledRequest): ProviderStatusResponse {
    const id = this.requireProvider(provider);
    if (!this.providers[id].configured) {
      throw new ArieNotFoundError(`${id} has not been configured for this organization`);
    }
    this.providers[id] = { ...this.providers[id], enabled: request.enabled };
    return this.providers[id];
  }

  removeProviderCredential(provider: string): void {
    const id = this.requireProvider(provider);
    if (!this.providers[id].configured) {
      throw new ArieNotFoundError(`${id} has not been configured for this organization`);
    }
    this.providers[id] = {
      provider: id,
      configured: false,
      enabled: false,
      updated_at: null,
      last_tested_at: null,
      last_test_status: null,
      last_test_error: null,
    };
  }

  /** Deterministic per-provider outcome, not random — a repeated click in a
   * demo/screenshot session should behave the same way every time. */
  testProviderConnection(provider: string): ProviderStatusResponse {
    const id = this.requireProvider(provider);
    if (!this.providers[id].configured) {
      throw new ArieNotFoundError(`${id} has not been configured for this organization`);
    }
    this.providers[id] = {
      ...this.providers[id],
      last_tested_at: new Date().toISOString(),
      last_test_status: "success",
      last_test_error: null,
    };
    return this.providers[id];
  }

  // ---------------------------------------------------------- onboarding --

  getOnboardingStatus(): OnboardingStatusResponse {
    const icpConfigured = this.icpProfiles.some((p) => p.status === "active");
    const providerConfigured = SUPPORTED_PROVIDERS.some((p) => this.providers[p].configured);
    const firstUploadCompleted = this.batches.length > 0;
    const firstBatchProcessed = this.batches.some((b) => b.progress.is_complete);
    const completed = icpConfigured && firstUploadCompleted && firstBatchProcessed;
    if (completed && !this.organization.onboarding_completed_at) {
      this.organization = {
        ...this.organization,
        onboarding_completed_at: new Date().toISOString(),
      };
    }
    return {
      account_created: true,
      organization_configured: Boolean(this.organization.name),
      icp_configured: icpConfigured,
      provider_configured: providerConfigured,
      first_upload_completed: firstUploadCompleted,
      first_batch_processed: firstBatchProcessed,
      completed,
      completed_at: this.organization.onboarding_completed_at,
    };
  }

  // -------------------------------------------------------------- limits --

  private readonly limits = {
    maxLeadsPerMonth: 5000,
    maxCsvRowsPerUpload: 200,
    maxModeledSpendUsdPerMonth: 50,
  };

  getUsageAgainstLimits(): UsageAgainstLimitsResponse {
    const usage = this.getUsage();
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return {
      leads_used: usage.leads_processed,
      leads_limit: this.limits.maxLeadsPerMonth,
      leads_remaining: Math.max(0, this.limits.maxLeadsPerMonth - usage.leads_processed),
      modeled_spend_used_usd: usage.total_cost_usd,
      modeled_spend_limit_usd: this.limits.maxModeledSpendUsdPerMonth,
      modeled_spend_remaining_usd: Math.max(
        0,
        this.limits.maxModeledSpendUsdPerMonth - usage.total_cost_usd,
      ),
      max_csv_rows_per_upload: this.limits.maxCsvRowsPerUpload,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      // Mock mode fabricates the same generous, always-entitled state the
      // Legacy Organization gets in production (`plan='internal'`) — see
      // `arie.billing.plans.PLAN_DEFINITIONS`. There is no real Stripe
      // subscription to simulate here.
      plan: "internal",
      members_used: this.members.filter((m) => m.status === "active").length,
      members_limit: 25,
    };
  }
}

const FINAL_DECISION_FOR_ACTION: Record<string, string> = {
  approve: "auto_route",
  reject: "reject",
  edit: "manual_review",
};

function actionForFinalDecision(finalDecision: string | null): string | null {
  if (finalDecision === null) return null;
  const entry = Object.entries(FINAL_DECISION_FOR_ACTION).find(([, v]) => v === finalDecision);
  return entry ? entry[0] : null;
}

const ALL_PROVIDER_NAMES = [
  "inbound_payload",
  "internal_crm",
  "dns_web",
  "firmographics_basic",
  "contact_enrich",
  "firmographics_premium",
  "intent_signals",
  "deep_research",
] as const;

const EXPLANATIONS: Record<string, string> = {
  decision_settled:
    "Given everything observed so far, no additional evidence could change this decision — the reachable score range no longer crosses a decision boundary. This reflects the facts collected, not certainty that they are correct.",
  confidence_reached:
    "The calibrated confidence model judged this decision reliable enough to act on without a human, based on the evidence collected so far.",
  all_providers_called:
    "Every available data provider was called; there was no further evidence left to purchase.",
};

function explanationFor(code: string): string {
  return EXPLANATIONS[code] ?? `Processing stopped: ${code}.`;
}

function sumCosts(calls: ProviderCallTemplate[]): string {
  const total = calls.reduce((sum, c) => sum + Number.parseFloat(c.cost_usd), 0);
  return total.toFixed(4);
}

export const mockStore = new MockArieStore();

/** Test-only escape hatch — clears persisted mock state between test runs. */
export function resetMockStoreForTests(): void {
  if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
  mockStore.resetForTests();
}
