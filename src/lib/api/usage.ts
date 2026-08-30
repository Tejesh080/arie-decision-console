import { apiClient } from "./client";
import { getDataMode } from "./mode";
import { mockStore } from "./mock/store";
import type { UsageSummary } from "./types";

export async function getUsage(fromAt?: string, toAt?: string): Promise<UsageSummary> {
  if (getDataMode() === "mock") return mockStore.getUsage();
  const params = new URLSearchParams();
  if (fromAt) params.set("from", fromAt);
  if (toAt) params.set("to", toAt);
  const query = params.toString();
  return apiClient.get<UsageSummary>(`/usage${query ? `?${query}` : ""}`);
}
