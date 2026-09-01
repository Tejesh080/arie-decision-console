/**
 * Types for the ARIE backend's public HTTP surface.
 *
 * Confirmed directly against the backend source
 * (arie-b2b-enrichment-engine, commit 80987ea):
 *   src/arie/api/schemas.py   — request/response Pydantic models
 *   src/arie/core/types.py    — LeadStatus, Decision enums
 *   src/arie/approval/workflow.py — ReviewAction enum
 *   src/arie/statemachine/transitions.py — status category sets
 *
 * This file is a plain mirror of that contract, not a reinterpretation of
 * it — field names, optionality, and enum values match exactly. Decimal
 * fields (costs, budget caps) arrive as JSON strings, matching Pydantic's
 * default `Decimal` serialization; they are never parsed to `number` here
 * to avoid float rounding on money.
 */

// ---------------------------------------------------------------- status --

/** `arie.core.types.LeadStatus` — every value the state machine can hold. */
export type LeadStatus =
  | "NEW"
  | "IDENTITY_RESOLVED"
  | "SCORING"
  | "FETCHING_EVIDENCE"
  | "INTEGRATING"
  | "DECISION"
  | "AUTO_ROUTED"
  | "AWAITING_HUMAN"
  | "MANUAL_REVIEW"
  | "ROUTED"
  | "SYNCED"
  | "FAILED"
  | "DEAD_LETTER"
  | "SHADOW_EVALUATED";

/**
 * Business-semantic status groups, mirroring
 * `arie.statemachine.transitions` exactly (same names, same membership).
 * This is a read-only label for the UI to key off of — it does not
 * recompute or second-guess anything the backend decided.
 */
export const QUALIFIED_STATUSES: readonly LeadStatus[] = ["AUTO_ROUTED", "ROUTED", "MANUAL_REVIEW"];
export const REJECTED_STATUSES: readonly LeadStatus[] = ["SYNCED"];
export const AWAITING_REVIEW_STATUSES: readonly LeadStatus[] = ["AWAITING_HUMAN"];
export const FAILURE_STATUSES: readonly LeadStatus[] = ["FAILED", "DEAD_LETTER"];
/** Post-M1 P5 — a shadow-mode lead's terminal status. Never authoritative:
 * no routing action taken, no review opened. Kept out of every other group
 * above on purpose, so nothing accidentally treats it as qualified/rejected/
 * awaiting-review/failed. */
export const SHADOW_STATUSES: readonly LeadStatus[] = ["SHADOW_EVALUATED"];
export const FINALIZED_STATUSES: readonly LeadStatus[] = [
  ...QUALIFIED_STATUSES,
  ...REJECTED_STATUSES,
];

/** Statuses the worker still auto-advances through — nothing to act on yet. */
export const IN_PROGRESS_STATUSES: readonly LeadStatus[] = [
  "NEW",
  "IDENTITY_RESOLVED",
  "SCORING",
  "FETCHING_EVIDENCE",
  "INTEGRATING",
  "DECISION",
];

/** True once a lead has left the auto-advancing chain — the point at which
 * polling should stop and the receipt becomes worth fetching. Named for
 * what it does for the UI, not a claim about the backend's own
 * `is_settled` scoring concept (a distinct, policy-internal idea). */
export function hasLeftProcessing(status: LeadStatus): boolean {
  return !IN_PROGRESS_STATUSES.includes(status);
}

export type Decision = "auto_route" | "escalate_human" | "reject";

export type ReviewAction = "approve" | "reject" | "edit";

export type ReceiptStatus = "pending" | "processing_failed" | "decided";

export type ProviderCallStatus = "success" | "miss" | "error" | "timeout";

// ---------------------------------------------------------------- leads --

/** `POST /leads` request body — `arie.api.schemas.IngestLeadRequest`. */
export interface IngestLeadRequest {
  source: string;
  email: string;
  external_ref?: string | null;
  company_domain?: string | null;
  company_name?: string | null;
  full_name?: string | null;
  title?: string | null;
  /** Decimal, sent as a string (e.g. "1.50"). Omit to use the backend default. */
  budget_usd_cap?: string | null;
  /** Post-M1 P5. `"shadow"` computes ARIE's full recommendation with no
   * authoritative routing action and no human review opened — see
   * `IngestLeadResponse.is_shadow`. Omit for the default `"normal"`. */
  mode?: "normal" | "shadow";
}

export interface IngestLeadResponse {
  lead_id: string;
  status: LeadStatus;
  created: boolean;
  company_id: string;
  person_id: string;
  job_id: string;
  job_created: boolean;
  job_requeued: boolean;
  /** The persisted shadow flag — may differ from this request's own `mode`
   * if `(source, external_ref)` already existed under a different mode. */
  is_shadow: boolean;
}

export interface LeadCostResponse {
  provider_cost_usd: string;
  model_cost_usd: string;
  total_cost_usd: string;
  provider_calls: number;
  cache_hits: number;
  provider_latency_ms: number;
}

export interface LeadResponse {
  lead_id: string;
  status: LeadStatus;
  version: number;
  source: string;
  external_ref: string | null;
  company_id: string | null;
  person_id: string | null;
  budget_usd_cap: string;
  is_shadow: boolean;
  created_at: string;
  updated_at: string;
  cost: LeadCostResponse;
}

// -------------------------------------------------------------- health --

export interface HealthResponse {
  status: "ok" | "degraded" | "down";
  database: boolean;
  schema_ready: boolean;
}

// ------------------------------------------------------------- receipt --

export interface ReceiptDecision {
  recommended_action: string;
  autonomous: boolean;
  final_status: LeadStatus;
  human_override: boolean;
}

export interface ReceiptScoreBounds {
  lower: number;
  upper: number;
}

export interface ReceiptScore {
  value: number;
  threshold_qualify: number;
  threshold_reject: number;
  bounds: ReceiptScoreBounds;
  confidence: number;
  tau: number;
}

export interface ReceiptStopping {
  reason_code: string;
  explanation: string;
}

export interface ReceiptCost {
  provider_cost_usd: string;
  model_cost_usd: string;
  total_cost_usd: string;
  budget_usd_cap: string;
}

export interface ReceiptEvidenceItem {
  field: string;
  source: string;
  confidence: number;
  contested: boolean;
}

export interface ReceiptEvidence {
  cache_hits: number;
  provider_calls: number;
  items: ReceiptEvidenceItem[];
  unknown_fields: string[];
}

export interface ReceiptProviderCall {
  provider: string;
  status: ProviderCallStatus;
  cost_usd: string;
  latency_ms: number | null;
  cache_hit: boolean;
}

export interface ReceiptProviders {
  called: ReceiptProviderCall[];
  /** Set difference against the catalogue — not a claim any of these was
   * individually evaluated and rejected. Render as "not called in this
   * run", never "skipped because it couldn't change the decision". */
  not_called: string[];
}

export interface ReceiptHumanReview {
  review_id: string;
  required: boolean;
  reviewer: string | null;
  original_decision: string | null;
  action: string | null;
  final_decision: string | null;
  responded_at: string | null;
}

export interface ReceiptVersions {
  policy: string;
  scorer: string;
  confidence_calibration: string;
  /** Productization M3. `null` for a receipt written before organization
   * ICP profiles existed, or one whose organization had no active profile
   * at decision time (both scored against the identical reference config). */
  icp_profile_id: string | null;
  icp_profile_version: number | null;
}

export interface ReceiptResponse {
  receipt_version: string;
  lead_id: string;
  status: ReceiptStatus;
  lead_status: LeadStatus;
  created_at: string | null;
  /** Post-M1 P5. When true, `decision`/`score`/`stopping` describe what ARIE
   * *would have* done — no authoritative routing action was taken and no
   * human review was opened, regardless of what `decision.recommended_action`
   * says. Never render a shadow receipt as if `lead_status` were the real
   * `AUTO_ROUTED`/`AWAITING_HUMAN` it structurally resembles. */
  shadow: boolean;
  decision: ReceiptDecision | null;
  score: ReceiptScore | null;
  stopping: ReceiptStopping | null;
  versions: ReceiptVersions | null;
  cost: ReceiptCost;
  evidence: ReceiptEvidence;
  providers: ReceiptProviders;
  human_review: ReceiptHumanReview | null;
}

// -------------------------------------------------------------- reviews --

export interface ReviewResponse {
  review_id: string;
  lead_id: string;
  requested_at: string;
  reviewer: string | null;
  original_decision: string | null;
  final_decision: string | null;
  notes: string | null;
  responded_at: string | null;
  is_pending: boolean;
  lead_status: LeadStatus;
  /** Pass back as `expected_lead_version` — never invent this value. */
  lead_version: number;
}

export interface ReviewDecisionRequest {
  action: ReviewAction;
  reviewer: string;
  /** Required, non-empty, when `action === "edit"`. */
  notes?: string | null;
  expected_lead_version: number;
}

export interface ReviewDecisionResponse {
  review_id: string;
  lead_id: string;
  action: ReviewAction;
  final_decision: string;
  reviewer: string;
  notes: string | null;
  responded_at: string;
  lead_status: LeadStatus;
  lead_version: number;
  already_applied: boolean;
}

// --------------------------------------------------------- ICP profiles --
//
// Productization M3. Mirrors `arie.icp_profiles.REFERENCE_CONFIG`'s shape
// and `arie.api.schemas.ICPProfileConfigInput`/`ICPProfileResponse` field
// for field. There is no separate top-level "weights" object — a field's
// ceiling is the highest value in its own point map (or band list); see the
// backend module's docstring for why duplicating that as an independent
// number would let the two disagree.

export interface EmployeeCountBand {
  min_employees: number;
  max_employees: number;
  points: number;
}

export interface ICPProfileConfig {
  qualify_threshold: number;
  reject_threshold: number;
  employee_count_bands: EmployeeCountBand[];
  industry_points: Record<string, number>;
  seniority_points: Record<string, number>;
  function_points: Record<string, number>;
  buying_intent_weight: number;
  trigger_event_weight: number;
  /** Advisory only — no evidence field supplies geography today, so this
   * never affects scoring. Never render it as a filter. */
  target_geographies: string[];
  disqualifier_enabled: boolean;
}

export interface ICPProfile {
  profile_id: string;
  organization_id: string;
  version: number;
  name: string;
  config: ICPProfileConfig;
  scorer_version: string;
  status: "active" | "retired";
  created_by_user_id: string | null;
  created_at: string;
  activated_at: string;
  retired_at: string | null;
}

export interface CreateICPProfileRequest {
  name: string;
  config: ICPProfileConfig;
}

// -------------------------------------------------------------- batches --
//
// Productization M3. Mirrors `arie.api.schemas.Batch*Response` field for
// field. Cost fields are unlabelled numbers here too — see
// `providerMode.ts`'s `costCaveat()` for the wording every screen reuses.

export interface BatchProgress {
  total_rows: number;
  accepted_rows: number;
  rejected_rows: number;
  processing_count: number;
  qualified_count: number;
  rejected_lead_count: number;
  review_count: number;
  failed_count: number;
  provider_cost_usd: number;
  model_cost_usd: number;
  total_cost_usd: number;
  is_complete: boolean;
}

export interface Batch {
  batch_id: string;
  organization_id: string;
  filename: string;
  total_rows: number;
  accepted_rows: number;
  rejected_rows: number;
  created_by_user_id: string;
  created_at: string;
  progress: BatchProgress;
}

export interface BatchRow {
  batch_id: string;
  row_number: number;
  raw_row: Record<string, string>;
  validation_status: "accepted" | "rejected";
  validation_error: string | null;
  lead_id: string | null;
  lead_status: LeadStatus | null;
}

export interface BatchRowsPage {
  items: BatchRow[];
  limit: number;
  offset: number;
  total: number;
}

// ---------------------------------------------------------------- usage --

export interface UsageSummary {
  from_at: string;
  to_at: string;
  leads_processed: number;
  qualified_count: number;
  rejected_count: number;
  review_count: number;
  pending_count: number;
  failed_count: number;
  provider_calls: number;
  cache_hits: number;
  provider_cost_usd: number;
  model_cost_usd: number;
  total_cost_usd: number;
}

// -------------------------------------------------------- organization --
//
// Productization M4. Mirrors `arie.api.schemas.OrganizationResponse` /
// `UpdateOrganizationRequest` field for field.

export interface OrganizationResponse {
  organization_id: string;
  name: string;
  slug: string;
  status: string;
  timezone: string;
  company_domain: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateOrganizationRequest {
  name?: string;
  timezone?: string;
  /** Explicit `null` clears it; omit to leave unchanged. */
  company_domain?: string | null;
}

// -------------------------------------------------------------- members --
//
// Mirrors `arie.api.schemas.MemberResponse` / `UpdateMemberRoleRequest`.
// Membership rows are created only via invitation acceptance — there is no
// direct "add member" endpoint.

/** `arie.auth.ROLES` — the only values `role` may take anywhere in M4. */
export const ROLES = ["owner", "admin", "analyst_reviewer"] as const;
export type Role = (typeof ROLES)[number];

export interface MemberResponse {
  organization_id: string;
  user_id: string;
  role: string;
  status: "active" | "removed";
  created_at: string;
  updated_at: string;
}

export interface UpdateMemberRoleRequest {
  role: string;
}

// --------------------------------------------------------- invitations --
//
// Mirrors `arie.api.schemas.InvitationResponse` / `InvitationCreatedResponse`
// / `CreateInvitationRequest` / `AcceptInvitationRequest`.

export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export interface InvitationResponse {
  invitation_id: string;
  organization_id: string;
  email_normalized: string;
  role: string;
  status: InvitationStatus;
  invited_by_user_id: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  /** Productization M6 Part 14 — delivery status of the invitation email
   * itself, independent of `status` above. `'failed'` does not mean the
   * invitation is unusable: the accept URL still works. */
  email_status: "pending" | "sent" | "failed";
  email_error: string | null;
  email_sent_at: string | null;
}

/** Only ever returned once, at creation — `raw_token` is never retrievable
 * again afterward. Never persist this beyond the moment it's shown. */
export interface InvitationCreatedResponse extends InvitationResponse {
  raw_token: string;
}

export interface CreateInvitationRequest {
  email: string;
  role: string;
}

export interface AcceptInvitationRequest {
  token: string;
}

// ----------------------------------------------------------- providers --
//
// Mirrors `arie.api.schemas.ProviderStatusResponse` /
// `SetProviderCredentialRequest` / `SetProviderEnabledRequest`. Never carries
// a raw credential — `ProviderStatus` on the backend structurally cannot hold
// one (see `arie.provider_configs`).

/** `arie.live.providers` registered live provider identifiers — the exact
 * `{provider}` path-parameter values the API expects, cheapest-first. Do not
 * add providers here that the backend doesn't support. */
export const SUPPORTED_PROVIDERS = [
  "abstract_company_enrichment",
  "hunter_combined_enrichment",
  "apollo_person_enrichment",
] as const;
export type ProviderId = (typeof SUPPORTED_PROVIDERS)[number];

export const PROVIDER_DISPLAY_NAMES: Record<ProviderId, string> = {
  abstract_company_enrichment: "Abstract",
  hunter_combined_enrichment: "Hunter",
  apollo_person_enrichment: "Apollo",
};

export interface ProviderStatusResponse {
  provider: string;
  configured: boolean;
  enabled: boolean;
  updated_at: string | null;
  last_tested_at: string | null;
  last_test_status: "success" | "failure" | null;
  /** Sanitized classification only (e.g. "authentication_failed:401") —
   * never a raw provider response, URL, or credential. */
  last_test_error: string | null;
}

export interface SetProviderCredentialRequest {
  credential: string;
}

export interface SetProviderEnabledRequest {
  enabled: boolean;
}

// ---------------------------------------------------------- onboarding --
//
// Mirrors `arie.api.schemas.OnboardingStatusResponse`. `provider_configured`
// is deliberately excluded from `completed` — BYOK is optional while
// PROVIDER_MODE stays simulated.

export interface OnboardingStatusResponse {
  account_created: boolean;
  organization_configured: boolean;
  icp_configured: boolean;
  provider_configured: boolean;
  first_upload_completed: boolean;
  first_batch_processed: boolean;
  completed: boolean;
  completed_at: string | null;
}

// --------------------------------------------------------------- limits --
//
// Mirrors `arie.api.schemas.UsageAgainstLimitsResponse`. `modeled_spend_*`
// fields are real ledger arithmetic over configured provider rates, never
// billed vendor spend — reuse `costCaveat()`'s wording, never "billed".

export interface UsageAgainstLimitsResponse {
  leads_used: number;
  leads_limit: number;
  leads_remaining: number;
  modeled_spend_used_usd: number;
  modeled_spend_limit_usd: number;
  modeled_spend_remaining_usd: number;
  max_csv_rows_per_upload: number;
  period_start: string;
  period_end: string;
  /** Productization M6 Part 23. */
  plan: string;
  members_used: number;
  members_limit: number;
}

// -------------------------------------------------------------- billing --
//
// Productization M6. Mirrors `arie.api.schemas.EffectiveEntitlementsResponse`
// / `OrganizationBillingResponse` / `BillingResponse` /
// `StartCheckoutRequest` / `CheckoutSessionResponse` / `BillingPortalRequest`
// / `BillingPortalResponse` field for field.

/** `arie.billing.service.PURCHASABLE_PLANS` — never `"internal"`, which is
 * grandfathered and not sold through Checkout. */
export const PURCHASABLE_PLANS = ["starter", "growth", "pro"] as const;
export type PurchasablePlan = (typeof PURCHASABLE_PLANS)[number];

/** `"unsubscribed"` is a synthetic value the backend never stores — the
 * safe floor for a plan with no currently-active subscription. */
export type EffectivePlan = PurchasablePlan | "internal" | "unsubscribed";

export interface EffectiveEntitlementsResponse {
  plan: EffectivePlan;
  max_leads_per_month: number;
  max_csv_rows_per_upload: number;
  max_modeled_spend_usd_per_month: number;
  max_members: number;
  live_provider_feature_allowed: boolean;
}

export type BillingStatus =
  | "none"
  | "incomplete"
  | "incomplete_expired"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused";

export interface OrganizationBillingResponse {
  organization_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: "internal" | PurchasablePlan;
  status: BillingStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingResponse {
  billing: OrganizationBillingResponse;
  entitlements: EffectiveEntitlementsResponse;
}

export interface StartCheckoutRequest {
  plan: PurchasablePlan;
  success_url: string;
  cancel_url: string;
}

export interface CheckoutSessionResponse {
  checkout_url: string;
}

export interface BillingPortalRequest {
  return_url?: string | null;
}

export interface BillingPortalResponse {
  portal_url: string;
}

// ---------------------------------------------------------- provisioning --
//
// Productization M6 Part 10. Mirrors `arie.api.schemas.CreateOrganizationRequest`
// / `CreateOrganizationResponse`.

export interface CreateOrganizationRequest {
  name: string;
  turnstile_token?: string | null;
}

export interface CreateOrganizationResponse {
  organization_id: string;
  slug: string;
}

// ---------------------------------------------------------------- targeting --
//
// M7 Slice 2. The AI-assisted way to configure targeting: describe the business
// in plain English and review what ARIE understood, instead of assigning six
// point weights by hand. `ICPProfileConfig` above is unchanged and remains what
// actually scores — a confirmed targeting draft becomes one of those.

export type TargetingObjective =
  | "best_prospects"
  | "maximize_buy_likelihood"
  | "high_value"
  | "minimize_wasted_outreach"
  | "custom";

export type PreferenceLevel = "none" | "low" | "medium" | "high" | "critical";

export type BandPreference = "preferred" | "acceptable" | "avoid";

export type EmployeeBandKey =
  | "employees_1_10"
  | "employees_11_50"
  | "employees_51_200"
  | "employees_201_1000"
  | "employees_1001_plus";

/** ARIE's structured reading of the two questions. Mirrors
 * `arie.intelligence.schemas.BusinessProfileDraft` field for field. Nothing
 * here is a point value or a threshold — the backend derives those, and it
 * re-derives them on confirm regardless of what this client sends. */
export interface BusinessProfileDraft {
  offering_summary: string;
  plain_english_summary: string;
  ideal_company_types: string[];
  preferred_industries: string[];
  acceptable_industries: string[];
  employee_band_preferences: Partial<Record<EmployeeBandKey, BandPreference>>;
  preferred_seniorities: string[];
  acceptable_seniorities: string[];
  preferred_functions: string[];
  acceptable_functions: string[];
  preferred_titles: string[];
  preferred_geographies: string[];
  preferred_company_characteristics: string[];
  positive_indicators: string[];
  negative_indicators: string[];
  hard_disqualifiers: string[];
  research_worthy_unknowns: string[];
  relative_preferences: Partial<Record<ScoringDimensionKey, PreferenceLevel>>;
}

export type ScoringDimensionKey =
  | "employee_count"
  | "industry"
  | "title_seniority"
  | "title_function"
  | "buying_intent"
  | "recent_trigger_event";

export interface ScoringDimensionSummary {
  dimension: string;
  label: string;
  points: number;
  rank: number;
}

export interface TargetingDraftRequest {
  what_you_sell: string;
  who_you_want: string;
  objective: TargetingObjective;
}

export interface TargetingDraftResponse {
  objective: TargetingObjective;
  profile: BusinessProfileDraft;
  /** The full technical document, for Advanced Details. A preview only —
   * nothing was written, and confirming recomputes it server-side. */
  scoring_config: ICPProfileConfig;
  allocation: ScoringDimensionSummary[];
  llm_provider: string | null;
  llm_model: string | null;
  /** Modelled cost, as a string. Never a billed figure. */
  llm_cost_usd: string;
}

export interface TargetingConfirmRequest {
  name: string;
  objective: TargetingObjective;
  profile: BusinessProfileDraft;
  llm_provider?: string | null;
  llm_model?: string | null;
}

export interface TargetingVocabularies {
  industries: string[];
  seniorities: string[];
  functions: string[];
  objectives: string[];
  preference_levels: string[];
  scoring_dimensions: string[];
}
