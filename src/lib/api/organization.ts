import { apiClient } from "./client";
import { getDataMode } from "./mode";
import { mockStore } from "./mock/store";
import type { OrganizationResponse, UpdateOrganizationRequest } from "./types";

export async function getOrganization(): Promise<OrganizationResponse> {
  if (getDataMode() === "mock") return mockStore.getOrganization();
  return apiClient.get<OrganizationResponse>("/organization");
}

export async function updateOrganization(
  input: UpdateOrganizationRequest,
): Promise<OrganizationResponse> {
  if (getDataMode() === "mock") return mockStore.updateOrganization(input);
  return apiClient.patch<OrganizationResponse>("/organization", input);
}
