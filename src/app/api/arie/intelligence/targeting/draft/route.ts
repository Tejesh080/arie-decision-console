import { NextRequest } from "next/server";
import { proxyToArie } from "@/lib/api/server/proxy";
import { requireAuth } from "@/lib/api/server/requireAuth";

/** Generation runs a model call plus a possible bounded repair retry, so this
 * route needs more headroom than the 30s every other proxy route uses. */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const body = await request.json();
  return proxyToArie("/intelligence/targeting/draft", { method: "POST", body }, auth.auth);
}
