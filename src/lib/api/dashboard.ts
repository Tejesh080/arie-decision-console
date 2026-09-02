import { apiClient } from "./client";
import { getDataMode } from "./mode";
import { mockStore } from "./mock/store";
import type { DashboardSummary } from "./types";

/** M7 Slice 7, Parts H/Q. Read-only, no LLM call — one bounded aggregate. */
export async function getDashboard(): Promise<DashboardSummary> {
  if (getDataMode() === "mock") return mockStore.getDashboard();
  return apiClient.get<DashboardSummary>("/dashboard");
}
