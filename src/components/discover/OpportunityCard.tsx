"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  ChevronDown,
  CircleHelp,
  Globe,
  Mail,
  Sparkles,
} from "lucide-react";
import clsx from "clsx";
import type { BuyerSignal, EmailStatus, Opportunity, OpportunityNextAction } from "@/lib/api/types";
import { nextActionLabel, priorityLabel, suitabilityLabel } from "@/lib/format/recommendation";
import { CopyButton } from "@/components/ui/CopyButton";
import { FeedbackButtons } from "@/components/lead/FeedbackButtons";
import { SPRING_LAYOUT } from "@/lib/motion";

/** The priority is the card's state light: one colour, one dot, one word.
 * It is not repeated as a badge, a border and a rail. */
const PRIORITY = {
  contact_first: { label: "text-qualify", dot: "bg-qualify", edge: "rgba(79,227,193,0.6)" },
  worth_pursuing: { label: "text-machine", dot: "bg-machine", edge: "rgba(108,140,255,0.55)" },
  review: { label: "text-human", dot: "bg-human", edge: "rgba(245,182,92,0.5)" },
  skip: { label: "text-text-faint", dot: "bg-pending", edge: "rgba(139,147,163,0.35)" },
} as const;

/** `nextActionLabel` covers the core vocabulary; `verify_contact_method` is
 * the one state Opportunity Activation added on top of it. */
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

/** Backend enums arrive machine-shaped (`c_level`, `finance_ops`). They are
 * real values and are shown as-is elsewhere, but a person's seniority read
 * out loud on a card should look like language, not a column name. */
function humanize(value: string | null): string | null {
  if (!value) return null;
  const spaced = value.replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function roleLine(buyer: BuyerSignal): string {
  return (
    [humanize(buyer.seniority), humanize(buyer.function)].filter(Boolean).join(" · ") ||
    "Role identified"
  );
}

function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/);
  if (words.length === 0 || words[0] === "") return "—";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Deterministic hue per company so the same logo mark is the same colour
 * on every render and every machine — never `Math.random()`. */
function monogramTint(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  return `linear-gradient(140deg, hsl(${hash} 42% 30%), hsl(${(hash + 40) % 360} 38% 18%))`;
}

/**
 * One discovered, verified company — the payoff of a discovery run.
 *
 * The card reads the way an analyst would hand it over: who the company is,
 * why they're worth your time, what that claim is based on, who to talk to,
 * and what to do next. Scores, suitability and provenance are trust
 * metadata and are sized like it — nothing here is computed client-side.
 */
export function OpportunityCard({ opportunity }: { opportunity: Opportunity }) {
  const [expanded, setExpanded] = useState(false);
  const reduced = useReducedMotion();
  const buyer = opportunity.buyer;
  const priority = PRIORITY[opportunity.priority];

  const hasEvidence =
    opportunity.key_evidence.length > 0 ||
    opportunity.missing_information.length > 0 ||
    opportunity.verified_facts !== null;

  // The one visual escalation on the whole results list: a card someone can
  // act on today gets the premium edge treatment, so the eye is pulled
  // toward the opportunities worth opening first.
  const contactReady = opportunity.priority === "contact_first" && !!buyer && hasUsableEmail(buyer);

  return (
    <li
      className={clsx(
        "liquid-surface liquid-edge group relative overflow-hidden rounded-2xl",
        contactReady && "spectral-edge",
      )}
    >
      {/* State light along the top edge, in the priority's colour. */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 z-[1] h-px"
        style={{ background: `linear-gradient(90deg, ${priority.edge}, transparent 65%)` }}
      />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_18.5rem]">
        {/* ------------------------------------------------- the company */}
        <div className="min-w-0 p-6 sm:p-7">
          <div className="flex items-start gap-3.5">
            <span
              aria-hidden
              className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[0.8125rem] font-semibold text-white/90 ring-1 ring-white/[0.08] ring-inset"
              style={{ background: monogramTint(opportunity.company_name) }}
            >
              {initials(opportunity.company_name)}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <h3 className="truncate text-[1.0625rem] font-semibold tracking-[-0.02em] text-text">
                  {opportunity.company_name}
                </h3>
                <span className={clsx("inline-flex items-center gap-1.5 text-[0.75rem] font-medium", priority.label)}>
                  <span aria-hidden className={clsx("h-1.5 w-1.5 rounded-full", priority.dot)} />
                  {priorityLabel(opportunity.priority)}
                </span>
              </div>

              <a
                href={opportunity.source_url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 text-[0.8125rem] text-text-faint transition-colors hover:text-text-dim"
              >
                <Globe aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                <span className="truncate">{opportunity.domain}</span>
                <ArrowUpRight aria-hidden className="h-3 w-3 shrink-0" strokeWidth={2} />
              </a>
            </div>
          </div>

          {/* -------------------------------------------------- why them */}
          <p className="mt-5 text-[1rem] leading-[1.62] text-text">{opportunity.short_reason}</p>

          {/* Trust metadata: quiet, factual, one line. */}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.75rem]">
            <SuitabilityMark opportunity={opportunity} />
            {opportunity.score !== null && (
              <span className="text-text-faint">
                Fit <span className="t-data text-text-dim">{Math.round(opportunity.score)}</span>
              </span>
            )}
            {opportunity.research_performed && (
              <span className="inline-flex items-center gap-1.5 text-text-faint">
                <Sparkles aria-hidden className="h-3 w-3" strokeWidth={2} />
                Researched further
              </span>
            )}
          </div>

          {opportunity.suitability !== "supported" && opportunity.suitability_reason && (
            <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-text-faint">
              {opportunity.suitability_reason}
            </p>
          )}

          {/* --------------------------------------------------- evidence */}
          {hasEvidence && (
            <div className="mt-5">
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.025] py-1.5 pr-3.5 pl-3 text-[0.8125rem] text-text-dim transition-colors hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-text"
              >
                <ChevronDown
                  aria-hidden
                  className={clsx("h-3.5 w-3.5 transition-transform duration-300", expanded && "rotate-180")}
                  strokeWidth={2}
                />
                {expanded ? "Hide the evidence" : "Show the evidence"}
              </button>

              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div
                    key="evidence"
                    initial={reduced ? false : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={reduced ? undefined : { height: 0, opacity: 0 }}
                    transition={SPRING_LAYOUT}
                    className="overflow-hidden"
                  >
                    <EvidenceChain opportunity={opportunity} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* ------------------------------------------------------- who
            Its own plane rather than a column of the same surface: the
            buyer is the output, and giving it a wall makes the card's
            asymmetry read as structure instead of leftover space. */}
        <div className="border-t border-white/[0.05] bg-white/[0.018] p-6 sm:p-7 lg:border-t-0 lg:border-l">
          <p className="text-[0.6875rem] font-semibold tracking-[0.11em] text-text-faint uppercase">
            Who to contact
          </p>

          <div className="mt-3.5">
            {buyer && buyer.name_known ? (
              <NamedBuyer buyer={buyer} />
            ) : buyer ? (
              <div>
                <p className="text-[0.9375rem] text-text">{roleLine(buyer)}</p>
                <p className="mt-1 text-[0.75rem] text-text-faint">
                  A role, not a person — no name was found for this one.
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-2.5">
                <CircleHelp
                  aria-hidden
                  className="mt-0.5 h-4 w-4 shrink-0 text-text-faint"
                  strokeWidth={2}
                />
                <p className="text-[0.875rem] text-text-faint">
                  Nobody identified yet at this company.
                </p>
              </div>
            )}
          </div>

          {opportunity.alternate_buyers.length > 0 && (
            <div className="mt-5 border-t border-white/[0.05] pt-4">
              <p className="text-[0.75rem] text-text-faint">Also at this company</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {opportunity.alternate_buyers.slice(0, 2).map((alt, index) => (
                  <li key={index} className="text-[0.8125rem] text-text-dim">
                    {alt.name_known
                      ? [alt.full_name, alt.title].filter(Boolean).join(" — ")
                      : roleLine(alt)}
                    {alt.email && (
                      <span
                        className={clsx(
                          "ml-1.5 text-[0.6875rem]",
                          hasUsableEmail(alt) ? "text-qualify" : "text-text-faint",
                        )}
                      >
                        {EMAIL_STATUS_LABEL[alt.email_status ?? "none"]}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ------------------------------------------------ next action */}
          <div className="mt-5 rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/[0.05] ring-inset">
            <p className="text-[0.6875rem] font-semibold tracking-[0.11em] text-text-faint uppercase">
              Next
            </p>
            <p className="mt-1.5 text-[0.9375rem] leading-snug text-text">
              {opportunityNextActionLabel(opportunity.next_action)}
            </p>
          </div>
        </div>
      </div>

      {/* Feedback is about the whole recommendation, so it sits on the
          card's base rather than inside the buyer column — which also stops
          the sidecar from driving the card's height. */}
      <div className="border-t border-white/[0.05] bg-white/[0.012] px-6 py-4 sm:px-7">
        <FeedbackButtons leadId={opportunity.lead_id} />
      </div>
    </li>
  );
}

/** The named buyer: the output of the whole run, presented like a person
 * rather than a row of metadata. */
function NamedBuyer({ buyer }: { buyer: BuyerSignal }) {
  const usable = hasUsableEmail(buyer);

  return (
    <div>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(140deg,rgba(79,227,193,0.9),rgba(108,140,255,0.85))] text-[0.75rem] font-semibold text-[#04120f]"
        >
          {initials(buyer.full_name ?? "")}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[0.9375rem] font-medium text-text">{buyer.full_name}</p>
          {buyer.title && (
            <p className="mt-0.5 text-[0.8125rem] leading-snug text-text-dim">{buyer.title}</p>
          )}
        </div>
      </div>

      {buyer.email ? (
        <div className="mt-3.5 flex items-center gap-2 rounded-lg bg-white/[0.03] py-2 pr-2 pl-3 ring-1 ring-white/[0.05] ring-inset">
          <Mail aria-hidden className="h-3.5 w-3.5 shrink-0 text-text-faint" strokeWidth={2} />
          <span className="t-data min-w-0 flex-1 truncate text-[0.75rem] text-text-dim">
            {buyer.email}
          </span>
          <CopyButton value={buyer.email} label="Copy email" />
        </div>
      ) : (
        <p className="mt-3.5 text-[0.8125rem] text-text-faint">No email found for them yet.</p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.75rem]">
        {/* Only worth a line when there's an address to qualify — with no
            email at all, the sentence above already said so. */}
        {buyer.email && (
          <span
            className={clsx(
              "inline-flex items-center gap-1.5",
              usable ? "text-qualify" : "text-text-faint",
            )}
          >
            <BadgeCheck aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            {EMAIL_STATUS_LABEL[buyer.email_status ?? "none"]}
          </span>
        )}
        {buyer.profile_url && (
          <a
            href={buyer.profile_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-text-faint transition-colors hover:text-text-dim"
          >
            Profile
            <ArrowUpRight aria-hidden className="h-3 w-3" strokeWidth={2} />
          </a>
        )}
      </div>
    </div>
  );
}

/** Suitability, as a quiet mark rather than a shouting badge. */
function SuitabilityMark({ opportunity }: { opportunity: Opportunity }) {
  if (opportunity.suitability === "supported") {
    return (
      <span className="inline-flex items-center gap-1.5 text-qualify">
        <BadgeCheck aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        {suitabilityLabel(opportunity.suitability)}
      </span>
    );
  }
  if (opportunity.suitability === "contradicted") {
    return (
      <span className="inline-flex items-center gap-1.5 text-reject">
        <AlertTriangle aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        {suitabilityLabel(opportunity.suitability)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-text-faint">
      <CircleHelp aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
      {suitabilityLabel(opportunity.suitability)}
    </span>
  );
}

/**
 * The evidence chain: source → what was found → what ARIE made of it.
 *
 * Drawn as a threaded list so the reader can see the conclusion came from
 * somewhere, which is the whole trust argument. Everything here is a field
 * the backend returned; nothing is inferred in the browser.
 */
function EvidenceChain({ opportunity }: { opportunity: Opportunity }) {
  const facts = opportunity.verified_facts;

  return (
    <div className="mt-4 border-l border-white/[0.07] pl-5">
      {facts && (
        <Link node="Their own website">
          <p className="text-[0.875rem] leading-relaxed text-text-dim">
            {facts.business_description}
          </p>
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-text-faint italic">
            {facts.reasoning}
          </p>
          {facts.products_services.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {facts.products_services.slice(0, 6).map((item) => (
                <li
                  key={item}
                  className="rounded-full bg-white/[0.04] px-2.5 py-1 text-[0.75rem] text-text-dim"
                >
                  {item}
                </li>
              ))}
            </ul>
          )}
        </Link>
      )}

      {opportunity.key_evidence.length > 0 && (
        <Link node="What ARIE knows">
          <ul className="flex flex-col gap-1.5">
            {opportunity.key_evidence.map((item) => (
              <li key={item} className="text-[0.875rem] leading-snug text-text-dim first-letter:uppercase">
                {item}
              </li>
            ))}
          </ul>
        </Link>
      )}

      {opportunity.missing_information.length > 0 && (
        <Link node="Still unknown">
          <ul className="flex flex-col gap-1.5">
            {opportunity.missing_information.map((item) => (
              <li key={item} className="text-[0.875rem] leading-snug text-text-faint first-letter:uppercase">
                {item}
              </li>
            ))}
          </ul>
        </Link>
      )}

      <Link node="How it was found" last>
        <p className="text-[0.8125rem] leading-relaxed text-text-faint">
          Search for{" "}
          <span className="t-data text-text-dim">&ldquo;{opportunity.search_query}&rdquo;</span> via{" "}
          {opportunity.discovery_source}
          {opportunity.website_verified_at && ", then checked against their site"}.
        </p>
      </Link>
    </div>
  );
}

/** One node on the chain: a dot on the rail, a label, and its content. */
function Link({
  node,
  children,
  last,
}: {
  node: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={clsx("relative", !last && "pb-5")}>
      <span
        aria-hidden
        className="absolute top-[0.4rem] -left-[1.4rem] h-1.5 w-1.5 rounded-full bg-white/25"
      />
      <p className="t-sys mb-2 text-text-faint">{node}</p>
      {children}
    </div>
  );
}
