import type { NextRequest } from "next/server";
import { proxyToArie } from "@/lib/api/server/proxy";

export async function POST(request: NextRequest) {
  const body = await request.json();
  return proxyToArie("/leads", { method: "POST", body });
}
