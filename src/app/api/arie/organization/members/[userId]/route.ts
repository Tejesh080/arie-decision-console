import type { NextRequest } from "next/server";
import { proxyToArie } from "@/lib/api/server/proxy";
import { requireAuth } from "@/lib/api/server/requireAuth";

export const maxDuration = 30;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { userId } = await params;
  const body = await request.json();
  return proxyToArie(
    `/organization/members/${encodeURIComponent(userId)}`,
    { method: "PATCH", body },
    auth.auth,
  );
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { userId } = await params;
  return proxyToArie(
    `/organization/members/${encodeURIComponent(userId)}`,
    { method: "DELETE" },
    auth.auth,
  );
}
