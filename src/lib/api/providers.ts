import { apiClient } from "./client";
import { getDataMode } from "./mode";
import { mockStore } from "./mock/store";
import type {
  ProviderId,
  ProviderStatusResponse,
  SetProviderCredentialRequest,
  SetProviderEnabledRequest,
} from "./types";

export async function listProviders(): Promise<ProviderStatusResponse[]> {
  if (getDataMode() === "mock") return mockStore.listProviders();
  return apiClient.get<ProviderStatusResponse[]>("/organization/providers");
}

export async function setProviderCredential(
  provider: ProviderId,
  input: SetProviderCredentialRequest,
): Promise<ProviderStatusResponse> {
  if (getDataMode() === "mock") return mockStore.setProviderCredential(provider, input);
  return apiClient.put<ProviderStatusResponse>(
    `/organization/providers/${encodeURIComponent(provider)}`,
    input,
  );
}

export async function setProviderEnabled(
  provider: ProviderId,
  input: SetProviderEnabledRequest,
): Promise<ProviderStatusResponse> {
  if (getDataMode() === "mock") return mockStore.setProviderEnabled(provider, input);
  return apiClient.patch<ProviderStatusResponse>(
    `/organization/providers/${encodeURIComponent(provider)}`,
    input,
  );
}

export async function removeProviderCredential(provider: ProviderId): Promise<void> {
  if (getDataMode() === "mock") {
    mockStore.removeProviderCredential(provider);
    return;
  }
  await apiClient.delete<void>(`/organization/providers/${encodeURIComponent(provider)}`);
}

export async function testProviderConnection(provider: ProviderId): Promise<ProviderStatusResponse> {
  if (getDataMode() === "mock") return mockStore.testProviderConnection(provider);
  return apiClient.post<ProviderStatusResponse>(
    `/organization/providers/${encodeURIComponent(provider)}/test`,
    undefined,
  );
}
