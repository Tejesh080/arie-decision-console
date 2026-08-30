import { NextRequest } from "next/server";
import { proxyFormToArie, proxyToArie } from "@/lib/api/server/proxy";
import { requireAuth } from "@/lib/api/server/requireAuth";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const query = request.nextUrl.search; // already includes the leading "?" or is ""
  return proxyToArie(`/batches${query}`, { method: "GET" }, auth.auth);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const formData = await request.formData();
  return proxyFormToArie("/batches", formData, auth.auth);
}
