import type { NextRequest } from "next/server";
import { proxyToArie } from "@/lib/api/server/proxy";
import { requireAuth } from "@/lib/api/server/requireAuth";

/**
 * Vercel function duration — an ambiguous question may trigger one bounded
 * LLM classification call server-side; same margin as the explanation/
 * research-plan routes.
 */
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const body = await request.json();
  return proxyToArie("/copilot/query", { method: "POST", body }, auth.auth);
}
