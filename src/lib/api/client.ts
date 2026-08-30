import { ArieUnavailableError, errorForResponse } from "./errors";

/**
 * Low-level transport for "api" mode. Every call goes to this app's own
 * same-origin proxy routes under `/api/arie/*` (see `src/app/api/arie/`),
 * never directly to the ARIE backend — the backend has no CORS middleware,
 * so a direct browser `fetch("http://localhost:8000/...")` would be
 * blocked. The proxy runs server-side, where CORS doesn't apply.
 *
 * This is the *only* place a request path is built. `leads.ts`/
 * `receipts.ts`/`reviews.ts`/`health.ts` call through here; nothing else in
 * the app constructs a fetch URL by hand.
 */

const DEFAULT_TIMEOUT_MS = 10_000;

export interface RequestOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

async function request<T>(
  path: string,
  init: RequestInit,
  options: RequestOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  // Combine an externally-supplied abort signal (e.g. a polling loop giving
  // up) with this call's own timeout, without one silently overriding the
  // other.
  const externalSignal = options.signal;
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  // A `FormData` body must never get an explicit `Content-Type` — the
  // browser sets `multipart/form-data; boundary=...` itself from the
  // `FormData` object, and a forced `application/json` here would corrupt
  // the encoding the server-side proxy then tries to parse.
  const isForm = init.body instanceof FormData;

  let response: Response;
  try {
    response = await fetch(`/api/arie${path}`, {
      ...init,
      signal: controller.signal,
      headers: isForm ? init.headers : { "Content-Type": "application/json", ...init.headers },
    });
  } catch (cause) {
    clearTimeout(timeout);
    if (controller.signal.aborted) {
      throw new ArieUnavailableError("Request to ARIE timed out.", { path });
    }
    throw new ArieUnavailableError("Could not reach the ARIE backend.", { path, cause });
  }
  clearTimeout(timeout);

  const text = await response.text();
  const body = text ? safeJsonParse(text) : undefined;

  if (!response.ok) {
    const message = extractMessage(body) ?? `ARIE request failed (${response.status})`;
    throw errorForResponse(response.status, message, body);
  }

  return body as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function extractMessage(body: unknown): string | undefined {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.detail === "string") return record.detail;
    if (typeof record.message === "string") return record.message;
    if (typeof record.error === "string") return record.error;
  }
  return undefined;
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { method: "GET" }, options),
  post: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }, options),
  /** For a multipart upload (`POST /batches`) — see `isForm` above for why
   * this bypasses the default JSON `Content-Type`. */
  postForm: <T>(path: string, form: FormData, options?: RequestOptions) =>
    request<T>(path, { method: "POST", body: form }, options),
};
