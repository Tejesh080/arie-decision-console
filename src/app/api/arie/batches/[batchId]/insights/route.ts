import { proxyToArie } from "@/lib/api/server/proxy";
import { requireAuth } from "@/lib/api/server/requireAuth";

export async function GET(_request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { batchId } = await params;
  return proxyToArie(
    `/batches/${encodeURIComponent(batchId)}/insights`,
    { method: "GET" },
    auth.auth,
  );
}
