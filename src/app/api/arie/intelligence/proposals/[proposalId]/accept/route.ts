import { NextRequest } from "next/server";
import { proxyToArie } from "@/lib/api/server/proxy";
import { requireAuth } from "@/lib/api/server/requireAuth";

export const maxDuration = 30;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ proposalId: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { proposalId } = await params;
  const body = await request.json().catch(() => ({}));
  return proxyToArie(
    `/intelligence/proposals/${encodeURIComponent(proposalId)}/accept`,
    { method: "POST", body },
    auth.auth,
  );
}
