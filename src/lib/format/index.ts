/** Decimal fields arrive from the backend as strings (Pydantic `Decimal`
 * JSON serialization) — parsed only for display formatting, never for
 * arithmetic that would need to be exact. */
export function formatUsd(value: string | number, digits = 4): string {
  const n = typeof value === "string" ? Number.parseFloat(value) : value;
  if (Number.isNaN(n)) return "—";
  return `$${n.toFixed(digits)}`;
}

/**
 * Cost figures for display at a glance. Trailing-zero noise ("$0.0000")
 * reads as precision the number does not have and buries the one thing that
 * matters — whether this run cost anything at all. Exact values stay
 * available via `formatUsd` in the detail tables.
 */
export function formatUsdCompact(value: string | number): string {
  const n = typeof value === "string" ? Number.parseFloat(value) : value;
  if (Number.isNaN(n)) return "—";
  if (n === 0) return "$0";
  // At or above a cent, money reads in two places -- "$1.50", never "$1.5".
  // Below a cent, show the four places provider rates are configured at,
  // trimming only the zeros beyond the last significant digit.
  if (n >= 0.01) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4).replace(/0+$/, "")}`;
}

export function parseUsd(value: string | number): number {
  const n = typeof value === "string" ? Number.parseFloat(value) : value;
  return Number.isNaN(n) ? 0 : n;
}

export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatScore(value: number): string {
  return value.toFixed(1);
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/**
 * "12 min ago" for recency scanning, falling back to an absolute date once
 * relative phrasing stops being useful. Callers must render this only after
 * mount — it reads the client clock, which would otherwise disagree with
 * whatever the server rendered and trip a hydration mismatch.
 */
export function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 45) return "just now";

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return rtf.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  const days = Math.round(hours / 24);
  if (days < 7) return rtf.format(-days, "day");

  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

export function formatLatency(ms: number | null): string {
  if (ms === null) return "—";
  if (ms === 0) return "0ms";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export { statusLabel, STATUS_LABELS, PROCESSING_SEQUENCE } from "./status";
