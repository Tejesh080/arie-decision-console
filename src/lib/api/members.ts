import { apiClient } from "./client";
import { getDataMode } from "./mode";
import { mockStore } from "./mock/store";
import type { MemberResponse, UpdateMemberRoleRequest } from "./types";

export async function listMembers(): Promise<MemberResponse[]> {
  if (getDataMode() === "mock") return mockStore.listMembers();
  return apiClient.get<MemberResponse[]>("/organization/members");
}

export async function updateMemberRole(
  userId: string,
  input: UpdateMemberRoleRequest,
): Promise<MemberResponse> {
  if (getDataMode() === "mock") return mockStore.updateMemberRole(userId, input);
  return apiClient.patch<MemberResponse>(
    `/organization/members/${encodeURIComponent(userId)}`,
    input,
  );
}

export async function removeMember(userId: string): Promise<MemberResponse> {
  if (getDataMode() === "mock") return mockStore.removeMember(userId);
  return apiClient.delete<MemberResponse>(`/organization/members/${encodeURIComponent(userId)}`);
}
