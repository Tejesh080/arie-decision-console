import type { NextRequest } from "next/server";
import { proxyToArie } from "@/lib/api/server/proxy";
import { requireAuth } from "@/lib/api/server/requireAuth";

export const maxDuration = 30;

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  return proxyToArie("/organization/invitations", { method: "GET" }, auth.auth);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const body = await request.json();
  return proxyToArie("/organization/invitations", { method: "POST", body }, auth.auth);
}
