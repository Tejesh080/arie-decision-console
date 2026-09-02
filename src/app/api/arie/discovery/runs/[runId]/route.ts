import { proxyToArie } from "@/lib/api/server/proxy";
import { requireAuth } from "@/lib/api/server/requireAuth";

export async function GET(_request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { runId } = await params;
  return proxyToArie(`/discovery/runs/${encodeURIComponent(runId)}`, { method: "GET" }, auth.auth);
}
