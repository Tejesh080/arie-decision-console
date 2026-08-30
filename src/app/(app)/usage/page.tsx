"use client";

import { useEffect, useState } from "react";
import { getUsage } from "@/lib/api/usage";
import type { UsageSummary } from "@/lib/api/types";
import { formatDateTime, formatUsd } from "@/lib/format";
import { costNoun, costCaveat } from "@/lib/api/providerMode";
import { Panel, Eyebrow } from "@/components/ui/Panel";
import { StatRow, Stat } from "@/components/ui/Stat";

export default function UsagePage() {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    getUsage()
      .then((result) => {
        if (!cancelled) setUsage(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-[1000px] px-5 py-10 sm:px-8">
      <header className="mb-8">
        <Eyebrow>Usage</Eyebrow>
        <h1 className="t-h1 mt-2 text-text">Organization usage</h1>
        {usage && (
          <p className="mt-3 text-sm text-text-faint">
            {formatDateTime(usage.from_at)} – {formatDateTime(usage.to_at)}
          </p>
        )}
      </header>

      {error && <p className="text-sm text-reject">{error}</p>}

      {loading ? (
        <p className="text-sm text-text-faint">Loading…</p>
      ) : usage ? (
        <div className="flex flex-col gap-6">
          <Panel padding="lg">
            <Eyebrow>Leads processed</Eyebrow>
            <p className="t-metric mt-2 text-4xl text-text">{usage.leads_processed}</p>
            <div className="mt-6">
              <StatRow>
                <Stat label="Qualified" value={usage.qualified_count} tone="qualify" />
                <Stat label="Rejected" value={usage.rejected_count} tone="reject" />
                <Stat label="Human review" value={usage.review_count} tone="human" />
                <Stat label="Pending" value={usage.pending_count} />
              </StatRow>
            </div>
            {usage.failed_count > 0 && (
              <p className="mt-4 text-xs text-reject">
                {usage.failed_count} lead(s) failed processing.
              </p>
            )}
          </Panel>

          <Panel padding="lg">
            <Eyebrow>Provider activity</Eyebrow>
            <div className="mt-4">
              <StatRow>
                <Stat label="Billable calls" value={usage.provider_calls} />
                <Stat label="Cache hits" value={usage.cache_hits} />
              </StatRow>
            </div>
          </Panel>

          <Panel padding="lg">
            <Eyebrow>{costNoun()}</Eyebrow>
            <div className="mt-4">
              <StatRow>
                <Stat label="Providers" value={formatUsd(usage.provider_cost_usd)} />
                <Stat label="Models" value={formatUsd(usage.model_cost_usd)} />
                <Stat label="Total" value={formatUsd(usage.total_cost_usd)} />
              </StatRow>
            </div>
            <p className="mt-4 text-[0.6875rem] leading-relaxed text-text-faint">{costCaveat()}</p>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
