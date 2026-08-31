import { apiClient } from "./client";
import { getDataMode } from "./mode";
import { mockStore } from "./mock/store";
import type { OnboardingStatusResponse } from "./types";

export async function getOnboardingStatus(): Promise<OnboardingStatusResponse> {
  if (getDataMode() === "mock") return mockStore.getOnboardingStatus();
  return apiClient.get<OnboardingStatusResponse>("/organization/onboarding");
}
