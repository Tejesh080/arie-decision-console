import { apiClient } from "./client";
import { getDataMode } from "./mode";
import { mockStore } from "./mock/store";
import type { UsageAgainstLimitsResponse } from "./types";

export async function getUsageAgainstLimits(): Promise<UsageAgainstLimitsResponse> {
  if (getDataMode() === "mock") return mockStore.getUsageAgainstLimits();
  return apiClient.get<UsageAgainstLimitsResponse>("/organization/limits");
}
