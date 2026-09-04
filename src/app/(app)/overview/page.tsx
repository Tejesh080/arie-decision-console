"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, MonitorSmartphone, Search } from "lucide-react";
import { getLead } from "@/lib/api/leads";
import { getRecentLeads, type RecentLeadEntry } from "@/lib/localHistory";
import type { LeadResponse } from "@/lib/api/types";
import { formatUsdCompact, parseUsd } from "@/lib/format";
import { costNounShort, costCaveat } from "@/lib/api/providerMode";
import { Eyebrow } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Mark } from "@/components/brand/Mark";
import { LeadCard } from "@/components/dashboard/LeadCard";
import { CustomerDashboard } from "@/components/dashboard/CustomerDashboard";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { REVEAL_VIEWPORT, entrance, stagger } from "@/lib/motion";

/**
 * The authenticated app home — reached only by a real session (`api` mode)
 * or freely in mock mode, exactly like every other route under `(app)`.
 * `/` never renders this; it's a separate route so the marketing homepage's
 * own identity can stay fixed regardless of who's looking at it. See
 * `middleware.ts` and `(app)/layout.tsx` for the actual gate.
 */
export default function OverviewPage() {
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

  const variants = entrance(reduced);

  return (
    <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
      <CustomerDashboard />

      {/* -------------------------------------------------- local activity */}
      <section className="border-t border-white/[0.05] py-24 sm:py-28">
        <motion.div
          variants={variants}
          initial="hidden"
          whileInView="show"
          viewport={REVEAL_VIEWPORT}
          className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5"
        >
          <div className="max-w-xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <Eyebrow>Your recent runs</Eyebrow>
              <Badge tone="neutral" size="sm">
                <MonitorSmartphone aria-hidden className="h-3 w-3" strokeWidth={2} />
                This browser
              </Badge>
            </div>
            <h2 className="t-h2 mt-3 text-text">Pick up where you left off.</h2>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-text-faint">
              Only the runs <em>you</em> started, remembered locally so you can find your way back.
              Other people&apos;s work never appears here, and an empty list doesn&apos;t mean an
              empty system.
            </p>
          </div>

          <form onSubmit={handleLookup} className="flex w-full items-center gap-2.5 sm:w-auto">
            <label htmlFor="lead-lookup" className="sr-only">
              Look up a lead by ID
            </label>
            <div className="relative flex-1 sm:w-72 sm:flex-none">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-text-faint"
                strokeWidth={2}
              />
              <input
                id="lead-lookup"
                value={lookupId}
                onChange={(e) => setLookupId(e.target.value)}
                placeholder="Open a lead by ID…"
                className="input t-data pl-10"
              />
            </div>
            <Button type="submit" disabled={!lookupId.trim()}>
              Open
            </Button>
          </form>
        </motion.div>

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
            variants={stagger(0.05)}
            initial="hidden"
            animate="show"
            className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
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

/** Counts across the locally-tracked set. Scoped in the label, not just in
 * a footnote — a number without its denominator is how dashboards start
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
    { label: "Runs here", raw: tracked, format: undefined, tone: "text-text" },
    {
      label: "Waiting on you",
      raw: awaiting,
      format: undefined,
      tone: awaiting > 0 ? "text-human" : "text-text",
    },
    {
      label: "Watched only",
      raw: shadow,
      format: undefined,
      tone: shadow > 0 ? "text-shadow-role" : "text-text",
    },
    { label: costNounShort(), raw: cost, format: formatUsdCompact, tone: "text-text" },
  ];

  return (
    <div className="liquid-surface liquid-edge mt-10 overflow-hidden rounded-2xl">
      <div className="grid grid-cols-2 sm:grid-cols-4">
        {items.map((item, i) => (
          <div key={item.label} className={clsxCell(i)}>
            <Eyebrow>{item.label}</Eyebrow>
            <p className={`t-metric mt-3.5 text-[2.25rem] sm:text-[2.5rem] ${item.tone}`}>
              <AnimatedNumber value={item.raw} format={item.format} />
            </p>
          </div>
        ))}
      </div>
      <p className="border-t border-white/[0.05] px-5 py-3 text-[0.75rem] leading-relaxed text-text-faint">
        Across {resolved} of {tracked} runs this browser could reach. {costCaveat()}
      </p>
    </div>
  );
}

/** Hairlines only between cells, and only where they don't box a cell in. */
function clsxCell(i: number) {
  const base = "p-6 sm:p-8";
  const rowBorder = i < 2 ? " border-b border-white/[0.05] sm:border-b-0" : "";
  const colBorder = i % 2 === 1 ? " border-l border-white/[0.05]" : "";
  const smColBorder = i > 0 ? " sm:border-l sm:border-white/[0.05]" : "";
  return base + rowBorder + colBorder + smColBorder;
}

function EmptyState() {
  return (
    <div className="liquid-surface liquid-edge mt-10 overflow-hidden rounded-2xl">
      <div className="relative flex flex-col items-start gap-8 p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
        <div className="max-w-lg">
          <h3 className="t-h3 text-text">Nothing on this browser yet.</h3>
          <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-text-dim">
            Start with a market search, or run one of the three examples above. Whatever you run
            shows up here so you can get back to it later.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/discover" variant="primary">
              Find customers
              <ArrowRight
                className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-0.5"
                strokeWidth={2.5}
              />
            </ButtonLink>
            <ButtonLink href="/leads/new?run=autonomous" variant="ghost">
              Run an example
            </ButtonLink>
          </div>
        </div>
        <div
          aria-hidden
          className="relative hidden h-28 w-28 shrink-0 items-center justify-center sm:flex"
        >
          <span
            className="absolute inset-0 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(79,227,193,0.10), transparent 68%)",
            }}
          />
          <Mark className="h-14 w-14 text-text-faint" live={false} />
        </div>
      </div>
    </div>
  );
}
