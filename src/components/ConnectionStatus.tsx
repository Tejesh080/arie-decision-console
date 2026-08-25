"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { getDataMode } from "@/lib/api/mode";
import { getHealth } from "@/lib/api/health";
import type { HealthResponse } from "@/lib/api/types";

/**
 * A status light, not a dashboard.
 *
 * This used to read "ARIE backend connected" in full — developer telemetry
 * competing with product information and making a portfolio piece look like a
 * staging console. It is now a dot: green and silent when everything is fine,
 * and only worth words when something is actually wrong. The accessible name
 * always carries the full sentence, so nothing is lost to screen readers.
 *
 * Polls `GET /healthz` through the proxy at a slow fixed interval — never on
 * every render, never sub-second.
 */
const POLL_INTERVAL_MS = 30_000;

type Look = {
  dot: string;
  text: string;
  ring: string;
  label: string;
  pulse: boolean;
  tone: "ok" | "warn";
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

  // Healthy is the boring case and gets the least ink: a dot and nothing else.
  // Degraded/down/connecting keep their label at every width, because those
  // are the states where a reader needs to know why the demo is misbehaving.
  const quiet = look.tone === "ok";

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5",
        !quiet && "rounded-full border px-2 py-1 backdrop-blur-sm sm:px-2.5",
        !quiet && look.ring,
        !quiet && "bg-surface/70",
      )}
      title={look.label}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        {look.pulse && <span className={clsx("absolute inset-0 rounded-full breathe", look.dot)} />}
        <span className={clsx("h-1.5 w-1.5 rounded-full", look.dot)} />
      </span>
      {!quiet && <span className={clsx("t-label", look.text)}>{look.label}</span>}
      <span className="sr-only">{look.label}</span>
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
      tone: "warn",
    };
  }
  if (health === null) {
    return {
      dot: "bg-pending",
      text: "text-pending",
      ring: "border-border-strong",
      label: "Connecting",
      pulse: true,
      tone: "warn",
    };
  }
  if (health.status === "ok") {
    return {
      dot: "bg-qualify",
      text: "text-qualify",
      ring: "border-qualify-edge",
      label: "Live demo · API healthy",
      pulse: false,
      tone: "ok",
    };
  }
  if (health.status === "degraded") {
    return {
      dot: "bg-human",
      text: "text-human",
      ring: "border-human-edge",
      label: "API degraded",
      pulse: true,
      tone: "warn",
    };
  }
  return {
    dot: "bg-reject",
    text: "text-reject",
    ring: "border-reject-edge",
    label: "API unreachable",
    pulse: false,
    tone: "warn",
  };
}
