import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./client";
import { ArieConflictError, ArieNotFoundError, ArieUnavailableError } from "./errors";

interface MockResponseSpec {
  ok?: boolean;
  status?: number;
  jsonBody?: unknown;
  text?: string;
}

function mockFetchOnce(response: MockResponseSpec) {
  const body =
    response.text ?? (response.jsonBody !== undefined ? JSON.stringify(response.jsonBody) : "");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: response.ok ?? true,
      status: response.status ?? 200,
      text: async () => body,
    } as Response),
  );
}

describe("apiClient", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses a successful JSON response", async () => {
    mockFetchOnce({ ok: true, status: 200, jsonBody: { lead_id: "abc" } });
    const result = await apiClient.get<{ lead_id: string }>("/leads/abc");
    expect(result.lead_id).toBe("abc");
  });

  it("calls the same-origin proxy path, never the backend directly", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "{}",
    } as Response);
    vi.stubGlobal("fetch", fetchSpy);

    await apiClient.get("/healthz");

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/arie/healthz",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("throws ArieNotFoundError on a 404 with a detail message", async () => {
    mockFetchOnce({ ok: false, status: 404, jsonBody: { detail: "no lead xyz" } });
    await expect(apiClient.get("/leads/xyz")).rejects.toBeInstanceOf(ArieNotFoundError);
  });

  it("throws ArieConflictError on a 409", async () => {
    mockFetchOnce({ ok: false, status: 409, jsonBody: { detail: "version conflict" } });
    await expect(apiClient.post("/reviews/r1/decision", {})).rejects.toBeInstanceOf(
      ArieConflictError,
    );
  });

  it("throws ArieUnavailableError when fetch itself rejects (connection refused)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(apiClient.get("/healthz")).rejects.toBeInstanceOf(ArieUnavailableError);
  });

  it("throws ArieUnavailableError when the request times out", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
          }),
      ),
    );

    const promise = apiClient.get("/healthz", { timeoutMs: 50 });
    const assertion = expect(promise).rejects.toBeInstanceOf(ArieUnavailableError);
    await vi.advanceTimersByTimeAsync(60);
    await assertion;
    vi.useRealTimers();
  });

  it("tolerates a non-JSON error body instead of crashing", async () => {
    mockFetchOnce({ ok: false, status: 500, text: "<html>Internal Server Error</html>" });
    await expect(apiClient.get("/leads/x")).rejects.toThrow();
  });
});
