import { apiClient } from "./client";
import { getDataMode } from "./mode";
import { mockStore } from "./mock/store";
import type { IngestLeadRequest, IngestLeadResponse, LeadResponse } from "./types";

export async function submitLead(input: IngestLeadRequest): Promise<IngestLeadResponse> {
  if (getDataMode() === "mock") return mockStore.createLead(input);
  return apiClient.post<IngestLeadResponse>("/leads", input);
}

export async function getLead(leadId: string): Promise<LeadResponse> {
  if (getDataMode() === "mock") return mockStore.getLead(leadId);
  return apiClient.get<LeadResponse>(`/leads/${encodeURIComponent(leadId)}`);
}
