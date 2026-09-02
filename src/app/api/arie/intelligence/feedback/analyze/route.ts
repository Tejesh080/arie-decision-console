import { proxyToArie } from "@/lib/api/server/proxy";
import { requireAuth } from "@/lib/api/server/requireAuth";

/** May trigger one bounded LLM call server-side (feedback pattern
 * interpretation) — same margin as the other AI-optional routes. */
export const maxDuration = 30;

export async function POST() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  return proxyToArie("/intelligence/feedback/analyze", { method: "POST" }, auth.auth);
}
