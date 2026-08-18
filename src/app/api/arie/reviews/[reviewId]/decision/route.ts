import type { NextRequest } from "next/server";
import { proxyToArie } from "@/lib/api/server/proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> },
) {
  const { reviewId } = await params;
  const body = await request.json();
  return proxyToArie(`/reviews/${encodeURIComponent(reviewId)}/decision`, { method: "POST", body });
}
