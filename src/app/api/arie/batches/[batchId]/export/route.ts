import { proxyDownloadToArie } from "@/lib/api/server/proxy";
import { requireAuth } from "@/lib/api/server/requireAuth";

/**
 * `GET /batches/{id}/export.csv` — the browser's own navigation carries the
 * Supabase session cookie `requireAuth` reads, so a plain `<a href>` to this
 * route triggers a real download with no client-side fetch/blob juggling.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { batchId } = await params;
  return proxyDownloadToArie(`/batches/${encodeURIComponent(batchId)}/export.csv`, auth.auth);
}
