import { proxyToArie } from "@/lib/api/server/proxy";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reviewId: string }> },
) {
  const { reviewId } = await params;
  return proxyToArie(`/reviews/${encodeURIComponent(reviewId)}`, { method: "GET" });
}
