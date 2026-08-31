import type { NextRequest } from "next/server";
import { proxyToArie } from "@/lib/api/server/proxy";
import { requireUserSession } from "@/lib/api/server/requireAuth";

export const maxDuration = 30;

/**
 * The one `/api/arie/*` route that does not gate on `requireAuth` — see
 * `requireUserSession`'s docstring. A user with zero organization
 * memberships must be able to reach this.
 */
export async function POST(request: NextRequest) {
  const auth = await requireUserSession();
  if (!auth.ok) return auth.response;
  const body = await request.json();
  return proxyToArie(
    "/invitations/accept",
    { method: "POST", body },
    { accessToken: auth.accessToken },
  );
}
