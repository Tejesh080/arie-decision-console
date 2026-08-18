import { proxyToArie } from "@/lib/api/server/proxy";

export async function GET(_request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  return proxyToArie(`/leads/${encodeURIComponent(leadId)}/receipt`, { method: "GET" });
}
