import { apiClient } from "./client";
import { ArieUnavailableError } from "./errors";
import { getDataMode } from "./mode";
import { mockStore } from "./mock/store";
import type { HealthResponse } from "./types";

export async function getHealth(): Promise<HealthResponse> {
  if (getDataMode() === "mock") return mockStore.getHealth();
  try {
    return await apiClient.get<HealthResponse>("/healthz", { timeoutMs: 4000 });
  } catch (error) {
    // /healthz can itself answer 503 with a body ("degraded"/"down") --
    // apiClient already parses that as ArieApiError with the body attached.
    // A *connection* failure (backend not running at all) surfaces as
    // ArieUnavailableError; normalize both into the same shape the
    // connection-status indicator renders, rather than throwing.
    if (error instanceof ArieUnavailableError && error.detail && typeof error.detail === "object") {
      const detail = error.detail as Partial<HealthResponse>;
      if (typeof detail.status === "string") {
        return {
          status: detail.status as HealthResponse["status"],
          database: Boolean(detail.database),
          schema_ready: Boolean(detail.schema_ready),
        };
      }
    }
    return { status: "down", database: false, schema_ready: false };
  }
}
