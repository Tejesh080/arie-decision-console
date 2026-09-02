import { proxyToArie } from "@/lib/api/server/proxy";
import { requireAuth } from "@/lib/api/server/requireAuth";

/**
 * Re-derives opportunities on demand — the backend's own selective-research
 * step is idempotent, so a slower-than-usual first pass here costs nothing
 * beyond what the original run already spent. See
 * `arie.discovery.orchestrator.list_opportunities`.
 */
export const maxDuration = 30;

export async function GET(_request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { runId } = await params;
  return proxyToArie(
    `/discovery/runs/${encodeURIComponent(runId)}/opportunities`,
    { method: "GET" },
    auth.auth,
    25_000,
  );
}
