import type { NextRequest } from "next/server";
import { proxyToArie } from "@/lib/api/server/proxy";
import { requireAuth } from "@/lib/api/server/requireAuth";

export const maxDuration = 30;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { provider } = await params;
  return proxyToArie(
    `/organization/providers/${encodeURIComponent(provider)}/test`,
    { method: "POST" },
    auth.auth,
  );
}
