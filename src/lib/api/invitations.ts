import { apiClient } from "./client";
import { getDataMode } from "./mode";
import { mockStore } from "./mock/store";
import type {
  AcceptInvitationRequest,
  CreateInvitationRequest,
  InvitationCreatedResponse,
  InvitationResponse,
} from "./types";

export async function listInvitations(): Promise<InvitationResponse[]> {
  if (getDataMode() === "mock") return mockStore.listInvitations();
  return apiClient.get<InvitationResponse[]>("/organization/invitations");
}

export async function createInvitation(
  input: CreateInvitationRequest,
): Promise<InvitationCreatedResponse> {
  if (getDataMode() === "mock") return mockStore.createInvitation(input);
  return apiClient.post<InvitationCreatedResponse>("/organization/invitations", input);
}

export async function revokeInvitation(invitationId: string): Promise<InvitationResponse> {
  if (getDataMode() === "mock") return mockStore.revokeInvitation(invitationId);
  return apiClient.delete<InvitationResponse>(
    `/organization/invitations/${encodeURIComponent(invitationId)}`,
  );
}

/**
 * The only call in this app made from an unauthenticated-by-org (but
 * signed-in) context — see `requireUserSession` on the proxy side. Not
 * data-mode-branched below the proxy boundary in "api" mode; mock mode still
 * goes through `mockStore` like every other domain here.
 */
export async function acceptInvitation(input: AcceptInvitationRequest): Promise<InvitationResponse> {
  if (getDataMode() === "mock") return mockStore.acceptInvitation(input);
  return apiClient.post<InvitationResponse>("/invitations/accept", input);
}
