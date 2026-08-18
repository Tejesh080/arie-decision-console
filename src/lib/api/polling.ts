import { getLead } from "./leads";
import { ArieTimeoutError } from "./errors";
import { hasLeftProcessing, type LeadStatus } from "./types";

export interface PollOptions {
  timeoutMs?: number;
  intervalMs?: number;
  onUpdate?: (status: LeadStatus) => void;
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_INTERVAL_MS = 900;

/**
 * Poll `GET /leads/{id}` until the lead leaves the auto-advancing part of
 * the state graph (see `hasLeftProcessing`), or give up after a bounded
 * wall-clock timeout. Never loops unbounded — a stuck worker or a genuinely
 * slow decision surfaces as a clear timeout, not a spinner that never ends.
 */
export async function pollLeadUntilSettled(
  leadId: string,
  options: PollOptions = {},
): Promise<LeadStatus> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    if (options.signal?.aborted) {
      throw new ArieTimeoutError("Polling was cancelled.");
    }

    const lead = await getLead(leadId);
    options.onUpdate?.(lead.status);
    if (hasLeftProcessing(lead.status)) return lead.status;

    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new ArieTimeoutError(
        `ARIE did not reach a decision within ${Math.round(timeoutMs / 1000)}s. ` +
          "It may still be processing — its receipt page will show the result once ready.",
      );
    }
    await sleep(Math.min(intervalMs, remaining));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
