import { apiClient } from "./client";
import { getDataMode } from "./mode";
import { mockStore } from "./mock/store";
import type { ReceiptResponse } from "./types";

export async function getReceipt(leadId: string): Promise<ReceiptResponse> {
  if (getDataMode() === "mock") return mockStore.getReceipt(leadId);
  return apiClient.get<ReceiptResponse>(`/leads/${encodeURIComponent(leadId)}/receipt`);
}
