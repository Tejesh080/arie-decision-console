import { apiClient } from "./client";
import { getDataMode } from "./mode";
import { mockStore } from "./mock/store";
import type { CreateOrganizationRequest, CreateOrganizationResponse } from "./types";

/**
 * Productization M6 Part 10 — self-service provisioning. Named
 * `organizations.ts` (plural), distinct from `organization.ts` (singular,
 * the caller's *own* organization): this one call happens before any
 * organization membership exists at all, matching the backend's
 * `POST /organizations` route and its `IdentityDep` (not `AuthDep`) auth
 * boundary.
 */
export async function createOrganization(
  input: CreateOrganizationRequest,
): Promise<CreateOrganizationResponse> {
  if (getDataMode() === "mock") return mockStore.createOrganization(input);
  return apiClient.post<CreateOrganizationResponse>("/organizations", input);
}
