import { proxyToArie } from "@/lib/api/server/proxy";
import { requireAuth } from "@/lib/api/server/requireAuth";

/**
 * Vercel function duration. Without this the platform default (10s on the
 * hobby tier) kills the function *before* the proxy's own 25s abort can
 * answer with a shaped JSON 502 — surfacing an unshaped platform 500 for any
 * backend response slower than ~10s (a cold start, a pooler stall). 30s keeps
 * the proxy's timeout the one that always fires first. An AI explanation
 * call is the slowest thing this route family does, so this margin matters
 * more here than most.
 */
export const maxDuration = 30;

export async function POST(_request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { leadId } = await params;
  return proxyToArie(
    `/leads/${encodeURIComponent(leadId)}/explanation`,
    { method: "POST" },
    auth.auth,
  );
}
