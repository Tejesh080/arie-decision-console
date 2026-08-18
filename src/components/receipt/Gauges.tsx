import { formatPercent, formatScore } from "@/lib/format";

/**
 * The reachable score range (`bounds`) against the qualify/reject
 * thresholds — visualizes *why* a score did or didn't cross a decision
 * boundary, the same fact `stopping.reason_code === "decision_settled"`
 * is about.
 */
export function ScoreGauge({
  value,
  lower,
  upper,
  thresholdReject,
  thresholdQualify,
}: {
  value: number;
  lower: number;
  upper: number;
  thresholdReject: number;
  thresholdQualify: number;
}) {
  const domainMin = Math.min(0, lower, thresholdReject - 10);
  const domainMax = Math.max(100, upper, thresholdQualify + 10);
  const span = domainMax - domainMin || 1;
  const pct = (n: number) => ((n - domainMin) / span) * 100;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-data text-2xl font-semibold text-text tabular-nums">
          {formatScore(value)}
        </span>
        <span className="font-data text-xs text-text-faint">
          bounds {formatScore(lower)}–{formatScore(upper)}
        </span>
      </div>
      <div className="relative mt-3 h-2.5 rounded-full bg-panel-2">
        {/* Reachable range */}
        <div
          className="absolute h-full rounded-full bg-machine-dim"
          style={{ left: `${pct(lower)}%`, width: `${Math.max(0, pct(upper) - pct(lower))}%` }}
        />
        {/* Reject threshold */}
        <div
          className="absolute top-1/2 h-4 w-px -translate-y-1/2 bg-reject"
          style={{ left: `${pct(thresholdReject)}%` }}
        />
        {/* Qualify threshold */}
        <div
          className="absolute top-1/2 h-4 w-px -translate-y-1/2 bg-qualify"
          style={{ left: `${pct(thresholdQualify)}%` }}
        />
        {/* Actual value */}
        <div
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-text bg-machine"
          style={{ left: `${pct(value)}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between font-data text-[0.65rem] text-text-faint">
        <span>reject &lt; {formatScore(thresholdReject)}</span>
        <span>qualify ≥ {formatScore(thresholdQualify)}</span>
      </div>
    </div>
  );
}

/** Confidence vs. the autonomy threshold tau — the second, independent
 * stopping rule. Deliberately drawn separately from the score gauge above:
 * settled and confident answer different questions. */
export function ConfidenceGauge({ confidence, tau }: { confidence: number; tau: number }) {
  const cleared = confidence >= tau;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-data text-2xl font-semibold text-text tabular-nums">
          {formatPercent(confidence)}
        </span>
        <span className="font-data text-xs text-text-faint">τ = {formatPercent(tau)}</span>
      </div>
      <div className="relative mt-3 h-2.5 rounded-full bg-panel-2">
        <div
          className={`absolute h-full rounded-full ${cleared ? "bg-qualify-dim" : "bg-reject-dim"}`}
          style={{ width: `${Math.min(100, confidence * 100)}%` }}
        />
        <div
          className="absolute top-1/2 h-4 w-px -translate-y-1/2 bg-human"
          style={{ left: `${Math.min(100, tau * 100)}%` }}
        />
      </div>
      <p className="mt-1.5 font-data text-[0.65rem] text-text-faint">
        {cleared ? "Cleared the autonomy threshold" : "Did not clear the autonomy threshold"}
      </p>
    </div>
  );
}
