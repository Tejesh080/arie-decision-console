import { apiClient } from "./client";
import { getDataMode } from "./mode";
import { mockStore } from "./mock/store";
import type { IngestLeadRequest, IngestLeadResponse, LeadResponse } from "./types";

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
