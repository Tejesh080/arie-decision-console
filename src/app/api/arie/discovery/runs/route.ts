import type { NextRequest } from "next/server";
import { proxyToArie } from "@/lib/api/server/proxy";
import { requireAuth } from "@/lib/api/server/requireAuth";

/**
 * Product Pivot. `POST` starts and finishes a discovery run synchronously —
 * see `arie.discovery.orchestrator`'s own module docstring for why that is
 * the right shape for this slice. `GET` lists past runs.
 *
 * Vercel function duration, well above the backend's own synchronous run
 * (search plan + discovery + screening + promotion + scoring + selective
 * research, bounded by `arie.discovery.orchestrator`'s hard candidate caps):
 * without this the platform default kills the function before the backend
 * — or the proxy's own 25s abort — can answer at all.
 */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const body = await request.json();
  return proxyToArie("/discovery/runs", { method: "POST", body }, auth.auth, 55_000);
}

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  return proxyToArie("/discovery/runs", { method: "GET" }, auth.auth);
}
