"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { getDataMode } from "@/lib/api/mode";
import { getHealth } from "@/lib/api/health";
import type { HealthResponse } from "@/lib/api/types";

/**
 * Telemetry, not an alert. Polls `GET /healthz` (through the proxy) at a
 * slow fixed interval — never on every render, never sub-second.
 *
 * Renders as a status *light*: a dot plus a label that collapses to just
 * the dot on narrow screens, so backend state stays visible on mobile
 * instead of being hidden the moment room gets tight. The accessible name
 * carries the full sentence at every width.
 */
const POLL_INTERVAL_MS = 30_000;

type Look = {
  dot: string;
  text: string;
  ring: string;
  label: string;
  pulse: boolean;
};

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

  const look = resolveLook(mode, health);

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-2 rounded-full border px-2 py-1 sm:px-2.5",
        "bg-surface/70 backdrop-blur-sm",
        look.ring,
      )}
      title={look.label}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        {look.pulse && <span className={clsx("absolute inset-0 rounded-full breathe", look.dot)} />}
        <span className={clsx("h-1.5 w-1.5 rounded-full", look.dot)} />
      </span>
      <span className={clsx("t-label hidden lg:inline", look.text)}>{look.label}</span>
      <span className="sr-only lg:hidden">{look.label}</span>
    </span>
  );
}

function resolveLook(mode: "mock" | "api", health: HealthResponse | null): Look {
  if (mode === "mock") {
    return {
      dot: "bg-human",
      text: "text-human",
      ring: "border-human-edge",
      label: "Mock data",
      pulse: false,
    };
  }
  if (health === null) {
    return {
      dot: "bg-pending",
      text: "text-pending",
      ring: "border-border-strong",
      label: "Connecting",
      pulse: true,
    };
  }
  if (health.status === "ok") {
    return {
      dot: "bg-qualify",
      text: "text-qualify",
      ring: "border-qualify-edge",
      label: "Backend live",
      pulse: false,
    };
  }
  if (health.status === "degraded") {
    return {
      dot: "bg-human",
      text: "text-human",
      ring: "border-human-edge",
      label: "Backend degraded",
      pulse: true,
    };
  }
  return {
    dot: "bg-reject",
    text: "text-reject",
    ring: "border-reject-edge",
    label: "Backend down",
    pulse: false,
  };
}
