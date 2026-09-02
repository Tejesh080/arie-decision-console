"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import clsx from "clsx";
import type { Opportunity } from "@/lib/api/types";
import { nextActionLabel, priorityLabel, priorityTone } from "@/lib/format/recommendation";
import { Badge } from "@/components/ui/Badge";
import { FeedbackButtons } from "@/components/lead/FeedbackButtons";

const PRIORITY_ACCENT = {
  contact_first: "before:bg-qualify",
  worth_pursuing: "before:bg-machine",
  review: "before:bg-human",
  skip: "before:bg-reject",
} as const;

/**
 * One discovered, promoted, scored company — the Discovery Pivot's payoff
 * card. Everything here comes straight off `Opportunity`, which is itself
 * `arie.recommendations.LeadRecommendation` (the same object every other
 * lead in the product shows) plus discovery provenance and a buyer signal.
 * No number here is computed client-side.
 */
export function OpportunityCard({ opportunity }: { opportunity: Opportunity }) {
  const [expanded, setExpanded] = useState(false);
  const buyer = opportunity.buyer;

  return (
    <li
      className={clsx(
        "surface relative overflow-hidden p-5",
        "before:absolute before:top-0 before:bottom-0 before:left-0 before:w-[2px] before:content-['']",
        PRIORITY_ACCENT[opportunity.priority],
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="t-h3 truncate text-text">{opportunity.company_name}</h3>
            <Badge tone={priorityTone(opportunity.priority)} size="sm">
              {priorityLabel(opportunity.priority)}
            </Badge>
          </div>
          <a
            href={opportunity.source_url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs text-text-faint hover:text-text-dim"
          >
            {opportunity.domain}
            <ExternalLink className="h-3 w-3" strokeWidth={2} />
          </a>
        </div>
        {opportunity.score !== null && (
          <div className="text-right">
            <p className="t-metric text-lg text-text">{Math.round(opportunity.score)}</p>
            <p className="text-[0.625rem] text-text-faint uppercase">score</p>
          </div>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-text-dim">{opportunity.short_reason}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="t-label text-text-faint">Buyer</p>
          {buyer ? (
            <p className="mt-1 text-sm text-text">
              {[buyer.seniority, buyer.function].filter(Boolean).join(" · ") || "Role identified"}
              <span className="ml-1.5 text-xs text-text-faint">(simulated signal, no name)</span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-text-faint">Not identified</p>
          )}
        </div>
        <div>
          <p className="t-label text-text-faint">Next</p>
          <p className="mt-1 text-sm text-text">{nextActionLabel(opportunity.next_action)}</p>
        </div>
      </div>

      {(opportunity.key_evidence.length > 0 || opportunity.missing_information.length > 0) && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-text-faint hover:text-text-dim"
          >
            <ChevronDown
              className={clsx("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")}
              strokeWidth={2}
            />
            {expanded ? "Hide evidence" : "View evidence"}
          </button>
          {expanded && (
            <div className="mt-2 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
              {opportunity.key_evidence.length > 0 && (
                <div>
                  <p className="t-label text-text-faint">Known</p>
                  <ul className="mt-1 flex flex-col gap-0.5 text-xs text-text-dim">
                    {opportunity.key_evidence.map((item) => (
                      <li key={item} className="capitalize">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {opportunity.missing_information.length > 0 && (
                <div>
                  <p className="t-label text-text-faint">Missing</p>
                  <ul className="mt-1 flex flex-col gap-0.5 text-xs text-text-faint">
                    {opportunity.missing_information.map((item) => (
                      <li key={item} className="capitalize">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-[0.6875rem] text-text-faint sm:col-span-2">
                Found via &ldquo;{opportunity.search_query}&rdquo; ({opportunity.discovery_source})
                {opportunity.research_performed && " · one additional fact researched"}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 border-t border-border pt-3">
        <FeedbackButtons leadId={opportunity.lead_id} />
      </div>
    </li>
  );
}
