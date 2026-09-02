import type { NextRequest } from "next/server";
import { proxyToArie } from "@/lib/api/server/proxy";
import { requireAuth } from "@/lib/api/server/requireAuth";

/**
 * Vercel function duration — see the sibling copilot/query route's identical
 * comment.
 */
export const maxDuration = 30;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { leadId } = await params;
  const body = await request.json();
  return proxyToArie(
    `/leads/${encodeURIComponent(leadId)}/copilot`,
    { method: "POST", body },
    auth.auth,
  );
}
