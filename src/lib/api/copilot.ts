import { apiClient } from "./client";
import { getDataMode } from "./mode";
import { mockStore } from "./mock/store";
import type { CopilotResponse, LeadCopilotResponse } from "./types";

/**
 * M7 Slice 6 — "Ask ARIE". Both calls are strictly read-only on the backend
 * (see `arie.copilot_service`'s own module docstring); this file never
 * exposes a way to mutate anything through the copilot surface.
 */

export async function askCopilot(question: string): Promise<CopilotResponse> {
  if (getDataMode() === "mock") return mockStore.askCopilot(question);
  // Above the transport default: an ambiguous question may trigger one
  // bounded LLM classification call server-side, the same reasoning
  // `getExplanation`/`getResearchPlan` already apply to their own AI calls.
  return apiClient.post<CopilotResponse>("/copilot/query", { question }, { timeoutMs: 20_000 });
}

export async function askLeadCopilot(
  leadId: string,
  question: string,
): Promise<LeadCopilotResponse> {
  if (getDataMode() === "mock") return mockStore.askLeadCopilot(leadId, question);
  return apiClient.post<LeadCopilotResponse>(
    `/leads/${encodeURIComponent(leadId)}/copilot`,
    { question },
    { timeoutMs: 20_000 },
  );
}
