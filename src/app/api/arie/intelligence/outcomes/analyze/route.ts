import { NextRequest } from "next/server";
import { proxyFormToArie } from "@/lib/api/server/proxy";
import { requireAuth } from "@/lib/api/server/requireAuth";

/** Reading a file's columns can involve a model call plus a bounded repair
 * retry, so this needs more headroom than the 30s most proxy routes use. */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const formData = await request.formData();
  return proxyFormToArie("/intelligence/outcomes/analyze", formData, auth.auth);
}
