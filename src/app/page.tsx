"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, MonitorSmartphone, Search } from "lucide-react";
import { getDataMode } from "@/lib/api/mode";
import { getLead } from "@/lib/api/leads";
import { getRecentLeads, type RecentLeadEntry } from "@/lib/localHistory";
import type { LeadResponse } from "@/lib/api/types";
import { formatUsdCompact, parseUsd } from "@/lib/format";
import { costNounShort, costCaveat } from "@/lib/api/providerMode";
import { Panel, Eyebrow } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Mark } from "@/components/brand/Mark";
import { DecisionField } from "@/components/graphics/DecisionField";
import { LeadCard } from "@/components/dashboard/LeadCard";
import { riseIn, riseInStill, stagger } from "@/lib/motion";

export default function DashboardPage() {
  const mode = getDataMode();
  const router = useRouter();
  const reduced = useReducedMotion();

  const [recent, setRecent] = useState<RecentLeadEntry[]>([]);
  const [leads, setLeads] = useState<Record<string, LeadResponse>>({});
  const [mounted, setMounted] = useState(false);
  const [lookupId, setLookupId] = useState("");

  useEffect(() => {
    // Reads localStorage, which doesn't exist during SSR -- must run
    // post-mount, not as lazy initial state (that would read on the
    // server-matching first client render too and desync from the SSR'd
    // empty list, not before it).
    const entries = getRecentLeads();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecent(entries);
    setMounted(true);

    // Best-effort, per-card: a card simply shows no status if its fetch
    // fails (deleted lead, momentary blip), never an error that would break
    // the rest of the list.
    let cancelled = false;
    Promise.allSettled(entries.map((entry) => getLead(entry.lead_id))).then((results) => {
      if (cancelled) return;
      const next: Record<string, LeadResponse> = {};
      results.forEach((result, i) => {
        if (result.status === "fulfilled") next[entries[i].lead_id] = result.value;
      });
      setLeads(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Every figure here is derived from leads *this browser* recorded, and
   * only from fields the backend actually returned for them. Nothing is a
   * claim about ARIE's global throughput: there is no endpoint that could
   * support one, so none is implied.
   */
  const scope = useMemo(() => {
    const fetched = recent.map((e) => leads[e.lead_id]).filter((l): l is LeadResponse => !!l);
    return {
      tracked: recent.length,
      resolved: fetched.length,
      awaiting: fetched.filter((l) => l.status === "AWAITING_HUMAN").length,
      shadow: fetched.filter((l) => l.status === "SHADOW_EVALUATED").length,
      cost: fetched.reduce((sum, l) => sum + parseUsd(l.cost.total_cost_usd), 0),
    };
  }, [recent, leads]);

  function handleLookup(event: React.FormEvent) {
    event.preventDefault();
    const id = lookupId.trim();
    if (id) router.push(`/leads/${id}`);
  }

  const variants = reduced ? riseInStill : riseIn;

  return (
    <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
      {/* ------------------------------------------------------------ hero */}
      <motion.section
        variants={stagger(0.07)}
        initial="hidden"
        animate="show"
        className="grid items-center gap-10 py-16 sm:py-20 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:gap-14"
      >
        <div className="max-w-[40rem]">
          <motion.div variants={variants}>
            <span className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface/70 py-1 pr-3 pl-1.5 backdrop-blur-sm">
              <Mark className="h-4 w-4 text-text-dim" />
              <span className="t-label text-text-dim">Adaptive Revenue Intelligence Engine</span>
            </span>
          </motion.div>

          <motion.h1 variants={variants} className="t-display mt-6 text-balance text-text">
            Not which provider to call next.{" "}
            <span className="block text-text-dim">Whether to call at all.</span>
          </motion.h1>

          <motion.p
            variants={variants}
            className="mt-6 text-[1.0625rem] leading-relaxed text-text-dim"
          >
            ARIE buys evidence for a lead only while it still changes the answer. It scores, checks
            its own confidence against an autonomy threshold, and then either acts, rejects, or
            hands the call to a person — and issues a receipt showing every reason it stopped where
            it did.
          </motion.p>

          <motion.div variants={variants} className="mt-8 flex flex-wrap items-center gap-3">
            <ButtonLink href="/leads/new" variant="primary" size="lg">
              Submit a lead
              <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
            </ButtonLink>
            {mode === "mock" && <Badge tone="human">Mock mode — no backend required</Badge>}
          </motion.div>
        </div>

        <motion.div variants={variants} className="relative -mx-2 lg:mx-0">
          <DecisionField />
        </motion.div>
      </motion.section>

      {/* -------------------------------------------------- local activity */}
      <section className="pb-24">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="t-h2 text-text">Recent activity</h2>
              <Badge tone="neutral" size="sm">
                <MonitorSmartphone aria-hidden className="h-3 w-3" strokeWidth={2} />
                This browser
              </Badge>
            </div>
            <p className="mt-1.5 max-w-xl text-sm text-text-faint">
              Leads submitted from this device, kept in local storage. ARIE exposes no endpoint to
              list leads globally, so this is not a view of server-side state — statuses and costs
              below are fetched live per lead.
            </p>
          </div>

          <form onSubmit={handleLookup} className="flex w-full items-center gap-2 sm:w-auto">
            <label htmlFor="lead-lookup" className="sr-only">
              Look up a lead by ID
            </label>
            <div className="relative flex-1 sm:w-72 sm:flex-none">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-text-faint"
                strokeWidth={2}
              />
              <input
                id="lead-lookup"
                value={lookupId}
                onChange={(e) => setLookupId(e.target.value)}
                placeholder="Look up any lead ID…"
                className="input t-data pl-9"
              />
            </div>
            <Button type="submit" disabled={!lookupId.trim()}>
              Open
            </Button>
          </form>
        </div>

        {scope.tracked > 0 && (
          <ScopeStrip
            tracked={scope.tracked}
            awaiting={scope.awaiting}
            shadow={scope.shadow}
            cost={scope.cost}
            resolved={scope.resolved}
          />
        )}

        {mounted && recent.length === 0 ? (
          <EmptyState />
        ) : (
          <motion.ul
            variants={stagger(0.045)}
            initial="hidden"
            animate="show"
            className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {recent.map((entry) => (
              <LeadCard
                key={entry.lead_id}
                entry={entry}
                lead={leads[entry.lead_id]}
                mounted={mounted}
              />
            ))}
          </motion.ul>
        )}
      </section>
    </div>
  );
}

/** Counts across the locally-tracked set. Scoped in the label, not just in a
 * footnote — a number without its denominator is how dashboards start
 * lying. */
function ScopeStrip({
  tracked,
  resolved,
  awaiting,
  shadow,
  cost,
}: {
  tracked: number;
  resolved: number;
  awaiting: number;
  shadow: number;
  cost: number;
}) {
  const items = [
    { label: "Tracked here", value: String(tracked), tone: "text-text" },
    {
      label: "Awaiting review",
      value: String(awaiting),
      tone: awaiting > 0 ? "text-human" : "text-text",
    },
    {
      label: "Shadow evaluated",
      value: String(shadow),
      tone: shadow > 0 ? "text-shadow-role" : "text-text",
    },
    { label: costNounShort(), value: formatUsdCompact(cost), tone: "text-text" },
  ];

  return (
    <div className="surface-flat mt-6 grid grid-cols-2 divide-border sm:grid-cols-4 sm:divide-x">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={i < 2 ? "border-b border-border p-4 sm:border-b-0" : "p-4"}
        >
          <Eyebrow>{item.label}</Eyebrow>
          <p className={`t-metric mt-2 text-2xl ${item.tone}`}>{item.value}</p>
        </div>
      ))}
      <p className="col-span-2 border-t border-border px-4 py-2.5 text-[0.6875rem] leading-relaxed text-text-faint sm:col-span-4">
        Across {resolved} of {tracked} leads this browser could reach. {costCaveat()}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <Panel className="mt-6" padding="lg">
      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-md">
          <Eyebrow>No local history</Eyebrow>
          <h3 className="t-h3 mt-2 text-text">Nothing submitted from this browser yet.</h3>
          <p className="mt-2 text-sm leading-relaxed text-text-dim">
            Submit a lead to watch it move through evidence acquisition, scoring and a confidence
            check — then read the receipt. Already have a lead ID? Paste it into the lookup above.
          </p>
          <div className="mt-5">
            <ButtonLink href="/leads/new" variant="primary">
              Submit your first lead
              <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
            </ButtonLink>
          </div>
        </div>
        <div
          aria-hidden
          className="hidden shrink-0 items-center justify-center rounded-xl border border-border bg-bg-sunken p-8 sm:flex"
        >
          <Mark className="h-16 w-16 text-text-faint" crossed={false} />
        </div>
      </div>
    </Panel>
  );
}
