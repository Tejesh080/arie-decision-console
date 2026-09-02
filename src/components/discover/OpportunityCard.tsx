"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, ExternalLink, Mail, ShieldQuestion } from "lucide-react";
import clsx from "clsx";
import type { BuyerSignal, EmailStatus, Opportunity, OpportunityNextAction } from "@/lib/api/types";
import { nextActionLabel, priorityLabel, priorityTone } from "@/lib/format/recommendation";
import { Badge } from "@/components/ui/Badge";
import { FeedbackButtons } from "@/components/lead/FeedbackButtons";

const PRIORITY_ACCENT = {
  contact_first: "before:bg-qualify",
  worth_pursuing: "before:bg-machine",
  review: "before:bg-human",
  skip: "before:bg-reject",
} as const;

/** `nextActionLabel` covers the core vocabulary; `verify_contact_method` is
 * the one state Opportunity Activation added on top of it — see
 * `OpportunityNextAction`'s own comment in `lib/api/types.ts`. */
function opportunityNextActionLabel(action: OpportunityNextAction): string {
  if (action === "verify_contact_method") return "Find or verify their contact details";
  return nextActionLabel(action);
}

const EMAIL_STATUS_LABEL: Record<EmailStatus, string> = {
  verified: "Verified",
  likely: "Likely",
  unverified: "Unverified",
  none: "No email found",
};

/** A named buyer with a real, usable channel — never claimed unless the
 * provider itself verified or scored it high-confidence. */
function hasUsableEmail(buyer: BuyerSignal): boolean {
  return (
    buyer.email !== null && (buyer.email_status === "verified" || buyer.email_status === "likely")
  );
}

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
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <a
              href={opportunity.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-text-faint hover:text-text-dim"
            >
              {opportunity.domain}
              <ExternalLink className="h-3 w-3" strokeWidth={2} />
            </a>
            {opportunity.verification_status === "verified" && (
              <span className="inline-flex items-center gap-1 text-xs text-qualify">
                <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
                Website verified
              </span>
            )}
            {opportunity.verification_status === "unavailable" && (
              <span className="inline-flex items-center gap-1 text-xs text-text-faint">
                <ShieldQuestion className="h-3 w-3" strokeWidth={2} />
                Website not reachable
              </span>
            )}
          </div>
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
          {buyer && buyer.name_known ? (
            <div className="mt-1">
              <p className="text-sm font-medium text-text">{buyer.full_name}</p>
              {buyer.title && <p className="text-xs text-text-dim">{buyer.title}</p>}
              {buyer.email ? (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-text-dim">
                  <Mail className="h-3 w-3 shrink-0" strokeWidth={2} />
                  <span className="truncate">{buyer.email}</span>
                  <Badge tone={hasUsableEmail(buyer) ? "qualify" : "pending"} size="sm">
                    {EMAIL_STATUS_LABEL[buyer.email_status ?? "none"]}
                  </Badge>
                </p>
              ) : (
                <p className="mt-1 text-xs text-text-faint">Email not found</p>
              )}
            </div>
          ) : buyer ? (
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
          <p className="mt-1 text-sm text-text">
            {opportunityNextActionLabel(opportunity.next_action)}
          </p>
        </div>
      </div>

      {(opportunity.key_evidence.length > 0 ||
        opportunity.missing_information.length > 0 ||
        opportunity.verified_facts !== null) && (
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
              {opportunity.verified_facts && (
                <div className="sm:col-span-2">
                  <p className="t-label text-text-faint">From their own website</p>
                  <p className="mt-1 text-xs text-text-dim">
                    {opportunity.verified_facts.business_description}
                  </p>
                  <p className="mt-1 text-[0.6875rem] text-text-faint italic">
                    {opportunity.verified_facts.reasoning}
                  </p>
                </div>
              )}
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
