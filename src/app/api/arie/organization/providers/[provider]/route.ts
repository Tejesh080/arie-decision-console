import type { NextRequest } from "next/server";
import { proxyToArie } from "@/lib/api/server/proxy";
import { requireAuth } from "@/lib/api/server/requireAuth";

export const maxDuration = 30;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { provider } = await params;
  return proxyToArie(
    `/organization/providers/${encodeURIComponent(provider)}`,
    { method: "GET" },
    auth.auth,
  );
}

/** Create/replace the stored credential. */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { provider } = await params;
  const body = await request.json();
  return proxyToArie(
    `/organization/providers/${encodeURIComponent(provider)}`,
    { method: "PUT", body },
    auth.auth,
  );
}

/** Enable/disable an already-configured provider. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { provider } = await params;
  const body = await request.json();
  return proxyToArie(
    `/organization/providers/${encodeURIComponent(provider)}`,
    { method: "PATCH", body },
    auth.auth,
  );
}

/** Remove the stored credential entirely. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { provider } = await params;
  return proxyToArie(
    `/organization/providers/${encodeURIComponent(provider)}`,
    { method: "DELETE" },
    auth.auth,
  );
}
