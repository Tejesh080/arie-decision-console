import { proxyToArie } from "@/lib/api/server/proxy";
import { requireAuth } from "@/lib/api/server/requireAuth";

/** May trigger one bounded LLM call server-side — same margin as the other
 * AI-optional routes. */
export const maxDuration = 30;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { batchId } = await params;
  return proxyToArie(
    `/batches/${encodeURIComponent(batchId)}/summary`,
    { method: "POST" },
    auth.auth,
  );
}
