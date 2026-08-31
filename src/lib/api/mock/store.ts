import { ArieApiError, ArieConflictError, ArieNotFoundError, ArieValidationError } from "../errors";
import type {
  AcceptInvitationRequest,
  Batch,
  BatchRow,
  BatchRowsPage,
  CreateICPProfileRequest,
  CreateInvitationRequest,
  HealthResponse,
  ICPProfile,
  ICPProfileConfig,
  IngestLeadRequest,
  IngestLeadResponse,
  InvitationCreatedResponse,
  InvitationResponse,
  LeadResponse,
  LeadStatus,
  MemberResponse,
  OnboardingStatusResponse,
  OrganizationResponse,
  ProviderId,
  ProviderStatusResponse,
  ReceiptResponse,
  ReviewDecisionRequest,
  ReviewDecisionResponse,
  ReviewResponse,
  SetProviderCredentialRequest,
  SetProviderEnabledRequest,
  UpdateMemberRoleRequest,
  UpdateOrganizationRequest,
  UsageAgainstLimitsResponse,
  UsageSummary,
} from "../types";
import { ROLES, SUPPORTED_PROVIDERS } from "../types";

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
      ...(request.company_domain !== undefined
        ? { company_domain: request.company_domain }
        : {}),
      updated_at: new Date().toISOString(),
    };
    return this.organization;
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
