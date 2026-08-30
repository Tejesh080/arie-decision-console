import { NextResponse } from "next/server";
import { resolveAuthContext } from "@/lib/auth/context";
import type { ArieAuthHeaders } from "./proxy";

/**
 * Every `/api/arie/*` route except `/healthz` calls this first. Returns the
 * backend-bound auth headers on success, or a ready-to-return `NextResponse`
 * on failure — the route handler never reaches `proxyToArie` (and the real
 * backend is never called) for an unauthenticated or org-less request.
 */
export async function requireAuth(): Promise<
  { ok: true; auth: ArieAuthHeaders } | { ok: false; response: NextResponse }
> {
  const context = await resolveAuthContext();

  if (context.state === "unauthenticated") {
    return { ok: false, response: NextResponse.json({ error: "unauthenticated" }, { status: 401 }) };
  }
  if (context.state === "no_organization") {
    return {
      ok: false,
      response: NextResponse.json({ error: "no_organization_membership" }, { status: 403 }),
    };
  }
  return {
    ok: true,
    auth: { accessToken: context.accessToken, organizationId: context.organizationId },
  };
}
