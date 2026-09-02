import { proxyToArie } from "@/lib/api/server/proxy";
import { requireAuth } from "@/lib/api/server/requireAuth";

/**
 * Vercel function duration — see the sibling explanation route's identical
 * comment. Planning may consult a model, so this margin matters here too.
 */
export const maxDuration = 30;

export async function POST(_request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { leadId } = await params;
  return proxyToArie(
    `/leads/${encodeURIComponent(leadId)}/research-plan`,
    { method: "POST" },
    auth.auth,
  );
}
