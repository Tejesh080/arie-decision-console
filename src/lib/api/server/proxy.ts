import { NextResponse } from "next/server";

/**
 * Server-only forwarding to the real ARIE backend. Every Route Handler
 * under `src/app/api/arie/` calls this — it is the one place
 * `NEXT_PUBLIC_ARIE_API_BASE_URL` is read and the one place a request to
 * the backend is actually issued. Exists because the backend has no CORS
 * middleware (confirmed against its source, not assumed) — a browser
 * calling it directly from a different origin would be blocked, so this
 * app's own server proxies instead, where CORS doesn't apply.
 *
 * Forwards status codes and JSON bodies verbatim in both directions —
 * never reinterprets a backend response, which would risk the proxy
 * silently weakening or drifting from the backend's actual semantics.
 */

const DEFAULT_BASE_URL = "http://localhost:8000";

/**
 * Must stay comfortably below the route handlers' exported `maxDuration`
 * (30s): if the platform kills the function before this abort fires, the
 * caller gets an unshaped platform 500 instead of the JSON 502 below — which
 * is exactly the "ARIE request failed (500)" a slow backend used to produce
 * under Vercel's 10s default duration.
 */
const PROXY_TIMEOUT_MS = 25_000;

function backendBaseUrl(): string {
  return process.env.NEXT_PUBLIC_ARIE_API_BASE_URL?.trim() || DEFAULT_BASE_URL;
}

export interface ArieAuthHeaders {
  accessToken: string;
  organizationId: string;
}

export async function proxyToArie(
  backendPath: string,
  init: { method: "GET" | "POST"; body?: unknown },
  auth?: ArieAuthHeaders,
): Promise<NextResponse> {
  const url = `${backendBaseUrl()}${backendPath}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  // Human callers only — the backend's other auth path (an ARIE organization
  // API key) is for machine callers (n8n, scripts) and never belongs in
  // browser-reachable code. Omitting `auth` entirely (the `/healthz` route)
  // is the one deliberate exception: that endpoint requires no caller
  // identity at all.
  if (auth) {
    headers["Authorization"] = `Bearer ${auth.accessToken}`;
    headers["X-Organization-Id"] = auth.organizationId;
  }

  try {
    const response = await fetch(url, {
      method: init.method,
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);

    const text = await response.text();
    const body = text ? safeJsonParse(text) : null;
    return NextResponse.json(body, { status: response.status });
  } catch (cause) {
    clearTimeout(timeout);
    const aborted = controller.signal.aborted;
    return NextResponse.json(
      {
        error: "backend_unreachable",
        message: aborted
          ? `ARIE backend at ${backendBaseUrl()} did not respond in time.`
          : `Could not reach the ARIE backend at ${backendBaseUrl()}. Is it running? ` +
            `(docker compose up -d in the arie-b2b-enrichment-engine repo)`,
        cause: cause instanceof Error ? cause.message : String(cause),
      },
      { status: 502 },
    );
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}
