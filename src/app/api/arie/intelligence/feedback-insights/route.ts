import { proxyToArie } from "@/lib/api/server/proxy";
import { requireAuth } from "@/lib/api/server/requireAuth";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  return proxyToArie("/intelligence/feedback-insights", { method: "GET" }, auth.auth);
}
