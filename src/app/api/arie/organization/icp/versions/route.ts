import { proxyToArie } from "@/lib/api/server/proxy";
import { requireAuth } from "@/lib/api/server/requireAuth";

export const maxDuration = 30;

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  return proxyToArie("/organization/icp/versions", { method: "GET" }, auth.auth);
}
