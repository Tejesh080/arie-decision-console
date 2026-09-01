/**
 * Typed error hierarchy for the ARIE API client. Every failure mode a
 * component needs to render differently gets its own class, rather than
 * components inspecting HTTP status codes or message strings themselves.
 */

export class ArieApiError extends Error {
  readonly status: number;
  readonly detail?: unknown;

  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = "ArieApiError";
    this.status = status;
    this.detail = detail;
  }
}

/** 404 — the lead, receipt, or review does not exist. */
export class ArieNotFoundError extends ArieApiError {
  constructor(message: string, detail?: unknown) {
    super(message, 404, detail);
    this.name = "ArieNotFoundError";
  }
}

/**
 * 409 — either a review already carries a different recorded decision
 * (`ReviewConflictError`) or the lead moved since the caller's
 * `expected_lead_version`/`expected_version` (`OptimisticConcurrencyError`).
 * The backend maps both to 409; the client's job is to refetch and show
 * the current state, not to retry blindly.
 */
export class ArieConflictError extends ArieApiError {
  constructor(message: string, detail?: unknown) {
    super(message, 409, detail);
    this.name = "ArieConflictError";
  }
}

/** 422 — request validation failed (e.g. an unnormalizable email). */
export class ArieValidationError extends ArieApiError {
  constructor(message: string, detail?: unknown) {
    super(message, 422, detail);
    this.name = "ArieValidationError";
  }
}

/**
 * The backend could not be reached at all — connection refused, DNS
 * failure, or the proxy route's own "backend unreachable" response.
 * Distinct from a 404/409/422, which mean the backend *answered*.
 */
export class ArieUnavailableError extends ArieApiError {
  constructor(message: string, detail?: unknown) {
    super(message, 0, detail);
    this.name = "ArieUnavailableError";
  }
}

/** 402 — Productization M6's plan-entitlement gate (a member-count ceiling,
 * or a live-provider feature this organization's plan doesn't include).
 * Distinct from every other error here: the request was well-formed and the
 * caller was authorized, but the *organization's plan* doesn't currently
 * allow it — the UI's response should point at Billing, not show a generic
 * failure. */
export class ArieEntitlementError extends ArieApiError {
  constructor(message: string, detail?: unknown) {
    super(message, 402, detail);
    this.name = "ArieEntitlementError";
  }
}

/** A client-side bounded wait (e.g. polling for a decision) ran out of time
 * without reaching the awaited state. Not an HTTP error — the backend may
 * still be working. */
export class ArieTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArieTimeoutError";
  }
}

/** Maps an HTTP status + parsed body to the right typed error. */
export function errorForResponse(status: number, message: string, detail?: unknown): ArieApiError {
  if (status === 402) return new ArieEntitlementError(message, detail);
  if (status === 404) return new ArieNotFoundError(message, detail);
  if (status === 409) return new ArieConflictError(message, detail);
  if (status === 422) return new ArieValidationError(message, detail);
  if (status === 502 || status === 503 || status === 0) {
    return new ArieUnavailableError(message, detail);
  }
  return new ArieApiError(message, status, detail);
}
