import { proxyToArie } from "@/lib/api/server/proxy";

export async function GET() {
  return proxyToArie("/healthz", { method: "GET" });
}
