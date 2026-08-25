"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Database, Zap } from "lucide-react";
import type { LeadResponse } from "@/lib/api/types";
import type { RecentLeadEntry } from "@/lib/localHistory";
import { formatRelative, formatUsdCompact } from "@/lib/format";
import { costNounShort } from "@/lib/api/providerMode";
import { Badge } from "@/components/ui/Badge";
import { StatusPill } from "@/components/ui/StatusPill";
import { riseIn, riseInStill } from "@/lib/motion";

/**
 * One locally-remembered lead.
 *
 * Everything shown beyond the name/email comes from a live `GET /leads/{id}`
 * — the card never guesses a status from the submission it recorded, because
 * a lead recorded here minutes ago may since have been reviewed, failed, or
 * resolved by someone else entirely. Until that fetch lands the card shows
 * its identity and nothing more, rather than a stale claim.
 */
export function LeadCard({
  entry,
  lead,
  mounted,
}: {
  entry: RecentLeadEntry;
  lead: LeadResponse | undefined;
  mounted: boolean;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.li variants={reduced ? riseInStill : riseIn} className="min-w-0">
      <Link
        href={`/leads/${entry.lead_id}`}
        className="group surface-flat relative flex h-full min-w-0 flex-col p-4 transition-[border-color,background-color,transform] duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-border-loud hover:bg-surface-2"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[0.9375rem] font-medium text-text">{entry.label}</p>
            <p className="t-data mt-0.5 truncate text-text-faint">{entry.email}</p>
          </div>
          <ArrowUpRight
            aria-hidden
            className="mt-0.5 h-4 w-4 shrink-0 text-text-faint opacity-0 transition-opacity duration-[180ms] group-hover:opacity-100"
            strokeWidth={2}
          />
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
          {lead ? (
            <StatusPill status={lead.status} size="sm" />
          ) : (
            <span className="skeleton h-[1.375rem] w-28 rounded-full" />
          )}
          {/* Only worth flagging separately while the status does not already
              say it — a SHADOW_EVALUATED lead wearing both reads as two
              different facts when it is one. */}
          {(lead?.is_shadow ?? entry.is_shadow) && lead?.status !== "SHADOW_EVALUATED" && (
            <Badge tone="shadow" variant="outline" size="sm">
              Shadow
            </Badge>
          )}
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <dl className="flex items-center gap-3.5">
            <div>
              <dt className="sr-only">{costNounShort()}</dt>
              <dd className="t-data text-text-dim">
                {lead ? formatUsdCompact(lead.cost.total_cost_usd) : "—"}
              </dd>
            </div>
            <div
              className="flex items-center gap-1 text-text-faint"
              title={lead ? `${lead.cost.provider_calls} fresh provider events` : undefined}
            >
              <Zap aria-hidden className="h-3 w-3" strokeWidth={2} />
              <span className="t-data">{lead?.cost.provider_calls ?? "—"}</span>
            </div>
            <div
              className="flex items-center gap-1 text-text-faint"
              title={lead ? `${lead.cost.cache_hits} cache reuses` : undefined}
            >
              <Database aria-hidden className="h-3 w-3" strokeWidth={2} />
              <span className="t-data">{lead?.cost.cache_hits ?? "—"}</span>
            </div>
          </dl>
          {/* Relative time reads the client clock, so it is withheld until
              after mount to keep the server and first client render equal. */}
          <span className="t-data shrink-0 text-[0.6875rem] text-text-faint">
            {mounted ? formatRelative(entry.submitted_at) : ""}
          </span>
        </div>
      </Link>
    </motion.li>
  );
}
