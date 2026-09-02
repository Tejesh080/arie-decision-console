import { apiClient } from "./client";
import { getDataMode } from "./mode";
import { mockStore } from "./mock/store";
import type {
  FeedbackResponse,
  IngestLeadRequest,
  IngestLeadResponse,
  LeadExplanationResponse,
  LeadRecommendationResponse,
  LeadResponse,
  SubmitFeedbackRequest,
} from "./types";

export async function submitLead(input: IngestLeadRequest): Promise<IngestLeadResponse> {
  if (getDataMode() === "mock") return mockStore.createLead(input);
  // 28s, above the transport default: a submit against a cold hosted backend
  // can legitimately take tens of seconds, and the proxy route holds the
  // request open for up to 25s (see server/proxy.ts) — this must outlast it,
  // or the client aborts a POST the backend then completes anyway.
  return apiClient.post<IngestLeadResponse>("/leads", input, { timeoutMs: 28_000 });
}

export async function getLead(leadId: string): Promise<LeadResponse> {
  if (getDataMode() === "mock") return mockStore.getLead(leadId);
  return apiClient.get<LeadResponse>(`/leads/${encodeURIComponent(leadId)}`);
}

/** M7 Slice 4. The customer-facing payoff — priority, next action, a
 * deterministic reason, no AI cost. Always cheap; see `getExplanation` for
 * the one call in this family allowed to spend an AI budget. */
export async function getRecommendation(leadId: string): Promise<LeadRecommendationResponse> {
  if (getDataMode() === "mock") return mockStore.getRecommendation(leadId);
  return apiClient.get<LeadRecommendationResponse>(
    `/leads/${encodeURIComponent(leadId)}/recommendation`,
  );
}

/** One on-demand, evidence-grounded explanation. Always resolves — an
 * unavailable model degrades to a deterministic explanation server-side
 * rather than throwing, so a caller only branches on `.source`. */
export async function getExplanation(leadId: string): Promise<LeadExplanationResponse> {
  if (getDataMode() === "mock") return mockStore.getExplanation(leadId);
  // Above the transport default: an AI call can take a few seconds longer
  // than a plain read, same reasoning as `submitLead`'s own timeout.
  return apiClient.post<LeadExplanationResponse>(
    `/leads/${encodeURIComponent(leadId)}/explanation`,
    {},
    { timeoutMs: 20_000 },
  );
}

export async function submitLeadFeedback(
  leadId: string,
  input: SubmitFeedbackRequest,
): Promise<FeedbackResponse> {
  if (getDataMode() === "mock") return mockStore.submitFeedback(leadId, input);
  return apiClient.post<FeedbackResponse>(`/leads/${encodeURIComponent(leadId)}/feedback`, input);
}

export async function getLeadFeedback(leadId: string): Promise<FeedbackResponse | null> {
  if (getDataMode() === "mock") return mockStore.getFeedback(leadId);
  return apiClient.get<FeedbackResponse | null>(`/leads/${encodeURIComponent(leadId)}/feedback`);
}
