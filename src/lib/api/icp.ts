import { apiClient } from "./client";
import { getDataMode } from "./mode";
import { mockStore } from "./mock/store";
import type { CreateICPProfileRequest, ICPProfile } from "./types";

export async function getActiveICPProfile(): Promise<ICPProfile> {
  if (getDataMode() === "mock") return mockStore.getActiveICPProfile();
  return apiClient.get<ICPProfile>("/organization/icp");
}

export async function listICPVersions(): Promise<ICPProfile[]> {
  if (getDataMode() === "mock") return mockStore.listICPVersions();
  return apiClient.get<ICPProfile[]>("/organization/icp/versions");
}

export async function getICPVersion(version: number): Promise<ICPProfile> {
  if (getDataMode() === "mock") return mockStore.getICPVersion(version);
  return apiClient.get<ICPProfile>(`/organization/icp/${encodeURIComponent(String(version))}`);
}

export async function createICPProfile(input: CreateICPProfileRequest): Promise<ICPProfile> {
  if (getDataMode() === "mock") return mockStore.createICPProfile(input);
  return apiClient.post<ICPProfile>("/organization/icp", input);
}
