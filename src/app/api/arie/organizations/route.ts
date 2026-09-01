import type { NextRequest } from "next/server";
import { proxyToArie } from "@/lib/api/server/proxy";
import { requireUserSession } from "@/lib/api/server/requireAuth";

export const maxDuration = 30;

/**
 * Self-service organization provisioning (Productization M6 Part 10) — like
 * `/invitations/accept`, this must work for a signed-in user with zero
 * organization memberships (that's the point), so it gates on
 * `requireUserSession`, not `requireAuth`.
 */
export async function POST(request: NextRequest) {
  const auth = await requireUserSession();
  if (!auth.ok) return auth.response;
  const body = await request.json();
  return proxyToArie("/organizations", { method: "POST", body }, { accessToken: auth.accessToken });
}
