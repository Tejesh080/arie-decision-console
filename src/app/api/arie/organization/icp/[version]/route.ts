import { proxyToArie } from "@/lib/api/server/proxy";
import { requireAuth } from "@/lib/api/server/requireAuth";

export const maxDuration = 30;

export async function GET(_request: Request, { params }: { params: Promise<{ version: string }> }) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { version } = await params;
  return proxyToArie(
    `/organization/icp/${encodeURIComponent(version)}`,
    { method: "GET" },
    auth.auth,
  );
}
