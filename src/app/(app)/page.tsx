"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { ArrowRight, MonitorSmartphone, Search } from "lucide-react";
import { getDataMode } from "@/lib/api/mode";
import { getLead } from "@/lib/api/leads";
import { getRecentLeads, type RecentLeadEntry } from "@/lib/localHistory";
import type { LeadResponse } from "@/lib/api/types";
import { formatUsdCompact, parseUsd } from "@/lib/format";
import { costNounShort, costCaveat } from "@/lib/api/providerMode";
import { Eyebrow } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Mark } from "@/components/brand/Mark";
import { HeroAurora } from "@/components/graphics/HeroAurora";
import { ProductFrame } from "@/components/graphics/ProductFrame";
import { AnimatedGridPattern } from "@/components/graphics/AnimatedGridPattern";
import { FunnelStory } from "@/components/marketing/FunnelStory";
import { LeadCard } from "@/components/dashboard/LeadCard";
import { DemoCards, DemoSteps } from "@/components/dashboard/DemoCards";
import { CustomerDashboard } from "@/components/dashboard/CustomerDashboard";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { REVEAL_VIEWPORT, arrival, entrance, stagger } from "@/lib/motion";

export default function OverviewPage() {
  const mode = getDataMode();
  const router = useRouter();
  const reduced = useReducedMotion();

  // `null` while `CustomerDashboard`'s fetch is still in flight (or hasn't
  // been asked to run at all, in mock mode) — the marketing block stays
  // hidden until we know for sure it's needed, so a signed-in customer never
  // sees the pitch flash in before their real dashboard replaces it.
  const [dashboardAvailable, setDashboardAvailable] = useState<boolean | null>(null);
  const handleDashboardAvailable = useCallback((available: boolean) => {
    setDashboardAvailable(available);
  }, []);
  const showMarketing = mode !== "api" || dashboardAvailable === false;

  // The hero settles back and dims as the next section arrives, so the page
  // reads as one camera move rather than two stacked screens.
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  // Neutralised by output range rather than by dropping the `style` prop:
  // the prop's presence must not depend on `reduced`, or the server (where
  // `useReducedMotion()` is always false) and the client render different
  // markup. Both start at 1, so the SSR'd HTML is identical either way.
  const heroOpacity = useTransform(heroProgress, [0, 1], reduced ? [1, 1] : [1, 0.25]);
  const heroScale = useTransform(heroProgress, [0, 1], reduced ? [1, 1] : [1, 0.96]);

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
  const arrive = arrival(reduced);

  return (
    <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
      {/* A real customer's own operational dashboard. Attempted only in
          "api" mode; the marketing block below is what renders instead
          once we know there's no dashboard to show — a signed-out visitor
          on the public homepage, or (mock mode) a demo visitor who was
          never going to have one. A signed-in customer with a real
          dashboard never sees the pitch for the product they're already
          using appear underneath it. */}
      {mode === "api" && <CustomerDashboard onAvailable={handleDashboardAvailable} />}

      {showMarketing && (
        <>
          {/* ------------------------------------------------------ hero */}
          <motion.section
            ref={heroRef}
            variants={stagger(0.075)}
            initial="hidden"
            animate="show"
            style={{ opacity: heroOpacity, scale: heroScale }}
            className="relative flex flex-col items-center pt-20 pb-20 text-center sm:pt-28 sm:pb-28"
          >
            <HeroAurora />

            <motion.div variants={variants}>
              <span className="liquid-surface liquid-edge inline-flex items-center gap-2.5 rounded-full py-1.5 pr-4 pl-2">
                <Mark className="h-4 w-4 text-qualify" />
                <span className="t-sys text-text-dim">Signal Intelligence</span>
              </span>
            </motion.div>

            <motion.h1
              variants={arrive}
              className="t-editorial mt-8 max-w-[52rem] text-[clamp(2.6rem,1.3rem+4.6vw,4.75rem)] leading-[1.04] text-balance text-text"
            >
              Most of the market is <span className="t-noise">noise.</span> ARIE finds the{" "}
              <span className="signal-word align-baseline">
                <span aria-hidden className="signal-word__halo">
                  signal.
                </span>
                <span aria-hidden className="signal-word__core">
                  signal.
                </span>
                <span aria-hidden className="signal-word__stroke">
                  signal.
                </span>
                <span className="sr-only">signal.</span>
              </span>
            </motion.h1>

            <motion.p variants={variants} className="t-lead mt-7 max-w-[34rem] text-pretty">
              Tell it what you sell. ARIE watches the market for the moment a company has a real
              reason to care, verifies what it finds on their own site, and names the person who
              owns the problem — evidence attached.
            </motion.p>

            {/* No Motion wrapper around these: `whileHover` makes Motion add
            `tabindex="0"` to the wrapper, which both mismatches on
            hydration (the prop is reduced-motion dependent, and
            `useReducedMotion()` is false on the server) and gives every CTA
            a second, useless tab stop in front of the real link. The
            buttons carry their own press, lift and sheen in CSS. */}
            <motion.div
              variants={variants}
              className="mt-9 flex flex-wrap items-center justify-center gap-3.5"
            >
              <ButtonLink href="/discover" variant="primary" size="lg">
                Find customers
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-0.5"
                  strokeWidth={2.5}
                />
              </ButtonLink>
              <ButtonLink href="/leads/new?run=autonomous" variant="secondary" size="lg">
                Watch a run
              </ButtonLink>
            </motion.div>

            {mode === "mock" && (
              <motion.p variants={variants} className="mt-5 text-[0.8125rem] text-text-faint">
                You&apos;re in demo mode — everything works, nothing is billed.
              </motion.p>
            )}

            <motion.div variants={arrive} className="mt-16 w-full sm:mt-20">
              <ProductFrame />
            </motion.div>
          </motion.section>

          {/* --------------------------------------------------- how it works */}
          <section className="relative border-t border-white/[0.05] py-24 sm:py-32">
            {/* A second, much quieter pass of the hero's grid pattern — the
            page's own rhythm re-asserting itself rather than a one-off
            hero effect. Half the opacity, no colour glow behind it. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[320px]"
              style={{
                maskImage: "radial-gradient(55% 90% at 78% 10%, black, transparent 75%)",
                WebkitMaskImage: "radial-gradient(55% 90% at 78% 10%, black, transparent 75%)",
              }}
            >
              <AnimatedGridPattern
                width={34}
                height={34}
                numSquares={18}
                maxOpacity={0.14}
                duration={5.5}
              />
            </div>

            <motion.div
              variants={variants}
              initial="hidden"
              whileInView="show"
              viewport={REVEAL_VIEWPORT}
              className="max-w-2xl"
            >
              <Eyebrow>How it gets there</Eyebrow>
              <h2 className="t-h2 mt-3 text-balance text-text">
                Four steps, and it stops as soon as the answer can&apos;t change.
              </h2>
              <p className="mt-4 text-[1.0313rem] leading-relaxed text-text-dim">
                Most of the market never costs you anything. ARIE only spends real research on the
                companies that survive its own screen — and shows you the reasoning either way.
              </p>
            </motion.div>

            <FunnelStory />
          </section>

          {/* -------------------------------------------------------- see it run */}
          <section className="border-t border-white/[0.05] py-24 sm:py-32">
            <motion.div
              variants={variants}
              initial="hidden"
              whileInView="show"
              viewport={REVEAL_VIEWPORT}
              className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5"
            >
              <div className="max-w-xl">
                <Eyebrow>See it run</Eyebrow>
                <h2 className="t-h2 mt-3 text-balance text-text">Three outcomes, live.</h2>
                <p className="mt-4 text-[1.0313rem] leading-relaxed text-text-dim">
                  Each example runs against the real backend and ends on the full reasoning —
                  including the one where ARIE decides it shouldn&apos;t act alone.
                </p>
              </div>
              <DemoSteps />
            </motion.div>

            <div className="mt-12">
              <DemoCards />
            </div>
          </section>

          {/* ------------------------------------------------------- pull quote */}
          <section className="relative overflow-hidden border-t border-white/[0.05] py-28 text-center sm:py-36">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10 opacity-70"
              style={{
                background:
                  "radial-gradient(560px 320px at 50% 40%, rgba(79,227,193,0.14), transparent 70%)",
              }}
            />
            <motion.p
              variants={arrival(reduced)}
              initial="hidden"
              whileInView="show"
              viewport={REVEAL_VIEWPORT}
              className="t-editorial mx-auto max-w-[46rem] text-[clamp(1.9rem,1.1rem+2.6vw,3.4rem)] leading-[1.12] text-balance text-text"
            >
              Most tools tell you who might buy. ARIE tells you who&apos;s{" "}
              <span className="signal-word align-baseline">
                <span aria-hidden className="signal-word__halo">
                  ready.
                </span>
                <span aria-hidden className="signal-word__core">
                  ready.
                </span>
                <span aria-hidden className="signal-word__stroke">
                  ready.
                </span>
                <span className="sr-only">ready.</span>
              </span>
            </motion.p>
          </section>
        </>
      )}

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
