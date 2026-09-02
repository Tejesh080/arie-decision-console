"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Upload } from "lucide-react";
import { getDashboard } from "@/lib/api/dashboard";
import type { DashboardSummary } from "@/lib/api/types";
import { formatPercent } from "@/lib/format";
import { priorityLabel, priorityTone } from "@/lib/format/recommendation";
import { Panel, Eyebrow, PanelHeader } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Stat } from "@/components/ui/Stat";

/**
 * "When I log in, what should I do?" — M7 Slice 7, Part H. One bounded
 * `GET /dashboard` call, no per-card fetch, no LLM anywhere on this page.
 */
export function CustomerDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getDashboard()
      .then((result) => {
        if (!cancelled) setSummary(result);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <section className="py-10">
        <span className="skeleton block h-3 w-32" />
        <span className="skeleton mt-3 block h-8 w-64" />
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="surface-flat h-24 p-4" />
          ))}
        </div>
      </section>
    );
  }

  if (error || !summary) {
    return null; // Best-effort — the marketing/demo content below still works.
  }

  const counts = summary.priority_counts;

  return (
    <section className="py-10">
      <Eyebrow>Dashboard</Eyebrow>
      <h1 className="t-h1 mt-1.5 text-text">What should I work on?</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Panel padding="sm" accent="qualify">
          <Stat
            label={priorityLabel("contact_first")}
            value={counts.contact_first}
            tone="qualify"
          />
        </Panel>
        <Panel padding="sm" accent="machine">
          <Stat
            label={priorityLabel("worth_pursuing")}
            value={counts.worth_pursuing}
            tone="machine"
          />
        </Panel>
        <Panel padding="sm" accent="human">
          <Stat label={priorityLabel("review")} value={counts.review} tone="human" />
        </Panel>
        <Panel padding="sm">
          <Stat label={priorityLabel("skip")} value={counts.skip} />
        </Panel>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Panel padding="lg">
          <PanelHeader eyebrow="Priority today" title="Start with these leads" />
          {summary.top_leads.length > 0 ? (
            <ul className="mt-4 flex flex-col gap-2">
              {summary.top_leads.map((lead) => (
                <li key={lead.lead_id}>
                  <Link
                    href={`/leads/${lead.lead_id}`}
                    className="group surface-flat flex items-center justify-between gap-4 p-3 transition-colors hover:border-border-loud hover:bg-surface-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge tone={priorityTone(lead.priority)} size="sm">
                          {priorityLabel(lead.priority)}
                        </Badge>
                        <p className="truncate text-sm font-medium text-text">
                          {lead.company ?? lead.contact ?? "Lead"}
                        </p>
                      </div>
                      <p className="mt-1 truncate text-xs text-text-dim">{lead.why}</p>
                    </div>
                    <ArrowUpRight
                      aria-hidden
                      className="h-4 w-4 shrink-0 text-text-faint opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                      strokeWidth={2}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-text-dim">Nothing needs attention right now.</p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <ButtonLink href="/leads/new" variant="primary" size="sm">
              <Upload className="h-3.5 w-3.5" strokeWidth={2.25} />
              Upload leads
            </ButtonLink>
            <ButtonLink href="/ask" variant="secondary" size="sm">
              Ask ARIE
            </ButtonLink>
            <ButtonLink href="/targeting" variant="ghost" size="sm">
              Review targeting
            </ButtonLink>
          </div>
        </Panel>

        <div className="flex flex-col gap-5">
          {summary.open_proposals.length > 0 ? (
            <Panel padding="sm" accent="human">
              <Eyebrow>Targeting improvement suggested</Eyebrow>
              <p className="mt-2 text-sm leading-relaxed text-text">
                {summary.open_proposals[0].summary}
              </p>
              <ButtonLink href="/targeting" variant="secondary" size="sm" className="mt-3">
                Review suggestion
              </ButtonLink>
            </Panel>
          ) : (
            <Panel padding="sm">
              <Eyebrow>Feedback signal</Eyebrow>
              <p className="mt-2 text-sm text-text-dim">
                {summary.feedback.total > 0
                  ? `${summary.feedback.total} recommendations reviewed so far. More feedback needed before ARIE can suggest a targeting change.`
                  : "More feedback needed — mark recommendations useful or not to help ARIE improve."}
              </p>
              {summary.feedback.total > 0 && summary.feedback.agreement_rate !== null && (
                <p className="mt-1.5 text-xs text-text-faint">
                  {formatPercent(summary.feedback.agreement_rate)} agreement so far
                </p>
              )}
            </Panel>
          )}

          {summary.latest_batch && (
            <Panel padding="sm">
              <Eyebrow>Recent batch</Eyebrow>
              <p className="mt-2 truncate text-sm font-medium text-text">
                {summary.latest_batch.filename}
              </p>
              <p className="mt-1 text-xs text-text-faint">
                {summary.latest_batch.total_rows} leads
              </p>
              <ButtonLink
                href={`/batches/${summary.latest_batch.batch_id}`}
                variant="ghost"
                size="sm"
                className="mt-2 px-0"
              >
                View batch
              </ButtonLink>
            </Panel>
          )}
        </div>
      </div>
    </section>
  );
}
