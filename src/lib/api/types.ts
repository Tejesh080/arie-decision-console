/**
 * Types for the ARIE backend's public HTTP surface.
 *
 * Confirmed directly against the backend source
 * (adaptive-revenue-intelligence-engine, commit 80987ea):
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
