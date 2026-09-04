"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, RotateCw, Search, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { getActiveICPProfile } from "@/lib/api/icp";
import { startDiscoveryRun } from "@/lib/api/discovery";
import type { CustomerPriority, DiscoveryRunWithOpportunities, ICPProfile } from "@/lib/api/types";
import { priorityLabel } from "@/lib/format/recommendation";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Panel";
import { Mark } from "@/components/brand/Mark";
import { DiscoveryProgress } from "@/components/discover/DiscoveryProgress";
import { FunnelSummary } from "@/components/discover/FunnelSummary";
import { OpportunityCard } from "@/components/discover/OpportunityCard";
import { arrival, entrance, stagger } from "@/lib/motion";
import { tapHaptic } from "@/lib/haptics";
import { pointerGlowLeave, pointerGlowMove } from "@/lib/pointerGlow";
import { AnimatedGridPattern } from "@/components/graphics/AnimatedGridPattern";

const PRIORITY_ORDER: CustomerPriority[] = ["contact_first", "worth_pursuing", "review", "skip"];
const DEFAULT_COUNT = 20;
const COUNT_OPTIONS = [10, 20, 30, 50];

/**
 * The product's primary surface: "tell me what you sell and I'll find the
 * companies worth your attention."
 *
 * The setup reads as one sentence rather than a stack of labelled fields —
 * a run is a short instruction, not a form to fill in. What you sell comes
 * from the targeting profile you already confirmed and is never re-asked
 * here; only the two things that change per run (how many, and where) are
 * editable.
 */
export default function DiscoverPage() {
  const reduced = useReducedMotion();
  const [profile, setProfile] = useState<ICPProfile | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [market, setMarket] = useState("");
  const [count, setCount] = useState(DEFAULT_COUNT);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiscoveryRunWithOpportunities | null>(null);

  useEffect(() => {
    let cancelled = false;
    getActiveICPProfile()
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {
        if (!cancelled) setProfileError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const run = await startDiscoveryRun({
        requested_opportunity_count: count,
        market: market.trim() || null,
      });
      setResult(run);
      tapHaptic();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unknown error");
    } finally {
      setRunning(false);
    }
  }

  const grouped = result
    ? PRIORITY_ORDER.map((priority) => ({
        priority,
        items: result.opportunities.filter((o) => o.priority === priority),
      })).filter((group) => group.items.length > 0)
    : [];

  const contactable = result?.opportunities.filter((o) => o.is_contactable).length ?? 0;

  return (
    <div className="relative mx-auto max-w-[1080px] px-5 pt-10 pb-28 sm:px-8 sm:pt-14">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[240px]"
        style={{
          maskImage: "radial-gradient(60% 85% at 22% 15%, black, transparent 72%)",
          WebkitMaskImage: "radial-gradient(60% 85% at 22% 15%, black, transparent 72%)",
        }}
      >
        <AnimatedGridPattern width={30} height={30} numSquares={22} maxOpacity={0.22} duration={4.5} />
      </div>

      <motion.header
        variants={stagger(0.06)}
        initial="hidden"
        animate="show"
        className="max-w-2xl"
      >
        <motion.div variants={entrance(reduced)}>
          <Eyebrow>Find customers</Eyebrow>
        </motion.div>
        <motion.h1 variants={arrival(reduced)} className="t-h1 mt-3 text-balance text-text">
          Who has a reason to hear from you?
        </motion.h1>
        <motion.p variants={entrance(reduced)} className="t-lead mt-4">
          ARIE searches the market against your targeting profile, screens what it finds before
          spending anything, and only researches the companies that survive.
        </motion.p>
      </motion.header>

      {/* ------------------------------------------------------- the setup */}
      <motion.form
        // `initial` never branches on reduced motion: it is rendered on the
        // server, where `useReducedMotion()` is always false, so a branch
        // here would mismatch on hydration. Only the timing changes.
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={
          reduced ? { duration: 0 } : { duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }
        }
        onPointerMove={pointerGlowMove}
        onPointerLeave={pointerGlowLeave}
        onSubmit={handleSubmit}
        className="liquid-surface liquid-edge spectral-edge grain-veil relative mt-10 overflow-hidden rounded-2xl p-7 sm:p-9"
      >
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 z-[1] h-px bg-[linear-gradient(90deg,rgba(79,227,193,0.5),transparent_60%)]"
        />

        <div className="flex flex-wrap items-center gap-x-3 gap-y-4 text-[1.0625rem] leading-[2.4] text-text-dim sm:text-[1.1875rem]">
          <span className="text-text">Find</span>

          <label htmlFor="discover-count" className="sr-only">
            How many opportunities
          </label>
          <div className="relative">
            <select
              id="discover-count"
              value={count}
              onChange={(e) => setCount(Number(e.target.value) || DEFAULT_COUNT)}
              disabled={running}
              className="appearance-none rounded-xl border border-white/[0.1] bg-white/[0.04] py-1.5 pr-9 pl-3.5 text-[1.0625rem] font-medium text-text transition-colors hover:border-white/[0.18] focus:border-qualify-edge focus:ring-3 focus:ring-qualify-wash focus:outline-none disabled:opacity-50 sm:text-[1.1875rem]"
            >
              {COUNT_OPTIONS.map((option) => (
                <option key={option} value={option} className="bg-surface-2 text-text">
                  {option}
                </option>
              ))}
            </select>
            <SlidersHorizontal
              aria-hidden
              className="pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 text-text-faint"
              strokeWidth={2}
            />
          </div>

          <span className="text-text">companies in</span>

          <label htmlFor="discover-market" className="sr-only">
            Market — leave blank for anywhere
          </label>
          <input
            id="discover-market"
            value={market}
            onChange={(e) => setMarket(e.target.value)}
            placeholder="anywhere"
            disabled={running}
            className="w-[9rem] min-w-0 flex-1 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 py-1.5 text-[1.0625rem] text-text transition-colors placeholder:text-text-faint hover:border-white/[0.18] focus:border-qualify-edge focus:ring-3 focus:ring-qualify-wash focus:outline-none disabled:opacity-50 sm:max-w-[16rem] sm:text-[1.1875rem]"
          />

          <span className="text-text">that fit</span>

          <span className="inline-flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-1.5">
            <Mark className="h-4 w-4 shrink-0 text-text-faint" live={!!profile} />
            <span className="truncate text-[1rem] font-medium text-text sm:text-[1.0625rem]">
              {profileError
                ? "no profile yet"
                : profile
                  ? profile.name
                  : "your targeting profile"}
            </span>
          </span>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-white/[0.05] pt-6">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={!profile}
            loading={running}
            loadingLabel="Investigating the market"
          >
            <Search className="h-4 w-4" strokeWidth={2.5} />
            Start investigating
          </Button>

          <Link
            href="/targeting"
            className="text-[0.875rem] text-text-faint underline-offset-4 transition-colors hover:text-text-dim hover:underline"
          >
            {profile ? "Change what you sell" : "Set up targeting first"}
          </Link>
        </div>

        {profileError && (
          <p className="mt-5 rounded-xl bg-human-dim/60 px-4 py-3 text-[0.875rem] leading-relaxed text-human ring-1 ring-human-edge/50 ring-inset">
            ARIE needs to know what you sell before it can search. It takes two questions —{" "}
            <Link href="/targeting" className="font-medium underline underline-offset-2">
              set up targeting
            </Link>
            .
          </p>
        )}
      </motion.form>

      {/* ------------------------------------------------------ in flight */}
      <AnimatePresence mode="wait">
        {running && (
          <motion.div
            key="running"
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            <DiscoveryProgress />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------------------------------------------------- error */}
      {error && !running && (
        <motion.section
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="liquid-surface liquid-edge mt-8 overflow-hidden rounded-2xl p-7"
        >
          <div className="flex items-start gap-3.5">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-reject-dim text-reject ring-1 ring-reject-edge/60 ring-inset">
              <TriangleAlert aria-hidden className="h-4 w-4" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[1rem] font-semibold text-text">That run didn&apos;t finish.</h2>
              <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-text-dim">
                Nothing was charged for a run that didn&apos;t complete. Try again — if it keeps
                happening, a narrower market usually finishes faster.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button type="button" onClick={handleSubmit} variant="secondary">
                  <RotateCw className="h-3.5 w-3.5" strokeWidth={2.25} />
                  Try again
                </Button>
                <details className="group/details">
                  <summary className="cursor-pointer list-none text-[0.8125rem] text-text-faint transition-colors hover:text-text-dim">
                    Technical detail
                  </summary>
                  <p className="t-data mt-2 rounded-lg bg-black/30 px-3 py-2 text-[0.75rem] break-words text-text-faint">
                    {error}
                  </p>
                </details>
              </div>
            </div>
          </div>
        </motion.section>
      )}

      {/* --------------------------------------------------------- results */}
      {result && !running && (
        <motion.section
          initial={reduced ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mt-12"
        >
          {result.opportunities.length > 0 && (
            <div className="mb-8 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <h2 className="t-h2 text-text">
                {result.opportunities.length}{" "}
                {result.opportunities.length === 1 ? "opportunity" : "opportunities"}
              </h2>
              <p className="text-[0.9375rem] text-text-dim">
                <span className="font-medium text-qualify">{contactable}</span> with someone you can
                contact today
              </p>
            </div>
          )}

          <FunnelSummary funnel={result.run.funnel} />

          {result.opportunities.length === 0 ? (
            <EmptyResult market={market} />
          ) : (
            <div className="mt-10 flex flex-col gap-12">
              {grouped.map((group) => (
                <div key={group.priority}>
                  <div className="flex items-baseline gap-3">
                    <h3 className="text-[1.0625rem] font-semibold tracking-[-0.02em] text-text">
                      {priorityLabel(group.priority)}
                    </h3>
                    <span className="t-data text-[0.8125rem] text-text-faint">
                      {group.items.length}
                    </span>
                    <span aria-hidden className="rule mt-2 flex-1" />
                  </div>
                  <motion.ul
                    variants={stagger(0.06)}
                    initial="hidden"
                    animate="show"
                    className="mt-5 flex flex-col gap-4"
                  >
                    {group.items.map((opportunity) => (
                      <motion.div key={opportunity.candidate_id} variants={arrival(reduced)}>
                        <OpportunityCard opportunity={opportunity} />
                      </motion.div>
                    ))}
                  </motion.ul>
                </div>
              ))}
            </div>
          )}
        </motion.section>
      )}

      {/* ------------------------------------------------ nothing run yet */}
      {!result && !running && !error && <FirstRunHint />}
    </div>
  );
}

/** Before the first run: not "nothing here", but what will happen and what
 * it costs you to find out. */
function FirstRunHint() {
  return (
    <section className="mt-12 grid gap-px overflow-hidden rounded-2xl bg-white/[0.05] sm:grid-cols-3">
      {[
        {
          title: "Most of the market is free",
          body: "Search and screening cost nothing. ARIE only pays for the companies that survive its own bar.",
        },
        {
          title: "Evidence, not adjectives",
          body: "Every opportunity comes back with what was found, where it came from, and what's still unknown.",
        },
        {
          title: "A person, not a company",
          body: "Where it can, ARIE names who owns the problem — and says plainly when it couldn't.",
        },
      ].map((item) => (
        <div key={item.title} className="liquid-surface rounded-none p-6 sm:p-7">
          <h3 className="text-[0.9375rem] font-semibold text-text">{item.title}</h3>
          <p className="mt-2 text-[0.875rem] leading-relaxed text-text-dim">{item.body}</p>
        </div>
      ))}
    </section>
  );
}

/** A run that legitimately found nothing. This is a real result, so it gets
 * a real explanation and a next move — not a shrug. */
function EmptyResult({ market }: { market: string }) {
  return (
    <div className="liquid-surface liquid-edge mt-10 overflow-hidden rounded-2xl p-8 sm:p-10">
      <div className="flex flex-col items-start gap-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-lg">
          <h3 className="t-h3 text-text">Nothing cleared the bar this time.</h3>
          <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-text-dim">
            ARIE searched{market.trim() ? ` ${market.trim()}` : " the market"} and screened what it
            found, but nothing had enough supporting evidence to be worth your time. That is a real
            answer — usually it means the targeting is narrower than the market, not that the
            market is empty.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/targeting"
              className="inline-flex items-center gap-1.5 text-[0.9375rem] font-medium text-qualify underline-offset-4 hover:underline"
            >
              Widen your targeting
              <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2.25} />
            </Link>
          </div>
        </div>
        <div aria-hidden className="relative hidden h-24 w-24 shrink-0 items-center justify-center sm:flex">
          <span
            className="absolute inset-0 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(154,164,180,0.09), transparent 68%)" }}
          />
          <Mark className="h-12 w-12 text-text-faint" live={false} />
        </div>
      </div>
    </div>
  );
}
