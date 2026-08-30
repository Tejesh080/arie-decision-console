import type { NextRequest } from "next/server";
import { proxyToArie } from "@/lib/api/server/proxy";
import { requireAuth } from "@/lib/api/server/requireAuth";

/**
 * Vercel function duration. Without this the platform default (10s on the
 * hobby tier) kills the function *before* the proxy's own 25s abort can
 * answer with a shaped JSON 502 — surfacing an unshaped platform 500 for any
 * backend response slower than ~10s (a cold start, a pooler stall). 30s keeps
 * the proxy's timeout the one that always fires first.
 */
export const maxDuration = 30;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { reviewId } = await params;
  const body = await request.json();
  return proxyToArie(
    `/reviews/${encodeURIComponent(reviewId)}/decision`,
    { method: "POST", body },
    auth.auth,
  );
}
