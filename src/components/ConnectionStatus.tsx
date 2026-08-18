"use client";

import { useEffect, useState } from "react";
import { getDataMode } from "@/lib/api/mode";
import { getHealth } from "@/lib/api/health";
import type { HealthResponse } from "@/lib/api/types";
import { Badge } from "./ui/Badge";

/**
 * A restrained status line, not an observability dashboard. Polls
 * `GET /healthz` (through the proxy) at a slow, fixed interval — never on
 * every render, never sub-second.
 */
const POLL_INTERVAL_MS = 30_000;

export function ConnectionStatus() {
  const mode = getDataMode();
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    if (mode === "mock") return;
    let cancelled = false;

    async function check() {
      const result = await getHealth();
      if (!cancelled) setHealth(result);
    }

    check();
    const interval = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [mode]);

  if (mode === "mock") {
    return (
      <Badge tone="human">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        Mock mode
      </Badge>
    );
  }

  if (health === null) {
    return (
      <Badge tone="pending">
        <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
        Checking ARIE backend…
      </Badge>
    );
  }

  if (health.status === "ok") {
    return (
      <Badge tone="qualify">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        ARIE backend connected
      </Badge>
    );
  }

  return (
    <Badge tone="reject">
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {health.status === "degraded" ? "ARIE backend degraded" : "ARIE backend unavailable"}
    </Badge>
  );
}
