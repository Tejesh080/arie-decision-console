import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pollLeadUntilSettled } from "./polling";
import { ArieTimeoutError } from "./errors";
import type { LeadResponse } from "./types";

const { getLeadMock } = vi.hoisted(() => ({ getLeadMock: vi.fn() }));
vi.mock("./leads", () => ({ getLead: getLeadMock }));

function lead(status: LeadResponse["status"]): LeadResponse {
  return {
    lead_id: "l1",
    status,
    version: 1,
    source: "test",
    external_ref: null,
    company_id: null,
    person_id: null,
    budget_usd_cap: "1.50",
    is_shadow: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    cost: {
      provider_cost_usd: "0",
      model_cost_usd: "0",
      total_cost_usd: "0",
      provider_calls: 0,
      cache_hits: 0,
      provider_latency_ms: 0,
    },
  };
}

describe("pollLeadUntilSettled", () => {
  beforeEach(() => {
    getLeadMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stops as soon as the lead leaves the processing statuses", async () => {
    getLeadMock
      .mockResolvedValueOnce(lead("NEW"))
      .mockResolvedValueOnce(lead("SCORING"))
      .mockResolvedValueOnce(lead("AUTO_ROUTED"));

    const result = await pollLeadUntilSettled("l1", { intervalMs: 1 });
    expect(result).toBe("AUTO_ROUTED");
    expect(getLeadMock).toHaveBeenCalledTimes(3);
  });

  it("calls onUpdate for every poll, including the terminal one", async () => {
    getLeadMock.mockResolvedValueOnce(lead("SCORING")).mockResolvedValueOnce(lead("SYNCED"));
    const seen: string[] = [];
    await pollLeadUntilSettled("l1", { intervalMs: 1, onUpdate: (s) => seen.push(s) });
    expect(seen).toEqual(["SCORING", "SYNCED"]);
  });

  it("never loops unbounded -- gives up with ArieTimeoutError past the deadline", async () => {
    getLeadMock.mockResolvedValue(lead("FETCHING_EVIDENCE"));
    await expect(
      pollLeadUntilSettled("l1", { timeoutMs: 5, intervalMs: 1 }),
    ).rejects.toBeInstanceOf(ArieTimeoutError);
  });

  it("stops immediately if the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(pollLeadUntilSettled("l1", { signal: controller.signal })).rejects.toBeInstanceOf(
      ArieTimeoutError,
    );
    expect(getLeadMock).not.toHaveBeenCalled();
  });
});
