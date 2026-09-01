import { apiClient } from "./client";
import { getDataMode } from "./mode";
import { mockStore } from "./mock/store";
import type {
  BillingPortalRequest,
  BillingPortalResponse,
  BillingResponse,
  CheckoutSessionResponse,
  StartCheckoutRequest,
} from "./types";

export async function getBilling(): Promise<BillingResponse> {
  if (getDataMode() === "mock") return mockStore.getBilling();
  return apiClient.get<BillingResponse>("/billing");
}

export async function startCheckout(input: StartCheckoutRequest): Promise<CheckoutSessionResponse> {
  if (getDataMode() === "mock") return mockStore.startCheckout();
  return apiClient.post<CheckoutSessionResponse>("/billing/checkout", input);
}

export async function openBillingPortal(
  input: BillingPortalRequest = {},
): Promise<BillingPortalResponse> {
  if (getDataMode() === "mock") return mockStore.openBillingPortal();
  return apiClient.post<BillingPortalResponse>("/billing/portal", input);
}
