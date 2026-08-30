import { NextRequest } from "next/server";
import { proxyToArie } from "@/lib/api/server/proxy";
import { requireAuth } from "@/lib/api/server/requireAuth";

export const maxDuration = 30;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { batchId } = await params;
  const query = request.nextUrl.search;
  return proxyToArie(
    `/batches/${encodeURIComponent(batchId)}/leads${query}`,
    { method: "GET" },
    auth.auth,
  );
}
