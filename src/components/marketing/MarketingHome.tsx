"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { ArrowRight, ExternalLink, Search } from "lucide-react";
import { getDataMode } from "@/lib/api/mode";
import { Eyebrow } from "@/components/ui/Panel";
import { ButtonLink } from "@/components/ui/Button";
import { Mark } from "@/components/brand/Mark";
import { HeroAurora } from "@/components/graphics/HeroAurora";
import { ReceiptFrame } from "@/components/graphics/ReceiptFrame";
import { AnimatedGridPattern } from "@/components/graphics/AnimatedGridPattern";
import { StoppingStory } from "@/components/marketing/StoppingStory";
import { DemoCards, DemoSteps } from "@/components/dashboard/DemoCards";
import { REVEAL_VIEWPORT, arrival, entrance, stagger } from "@/lib/motion";

const GITHUB_URL = "https://github.com/Tejesh080/arie-b2b-enrichment-engine";

/**
 * The public marketing homepage — everything at `/`, for every visitor,
 * signed in or not. It never swaps for a dashboard: `(app)/overview` is the
 * authenticated app home now, a separate route, so this page's own identity
 * stays fixed regardless of session state. `authenticated` exists only to
 * retarget the primary CTA ("Open ARIE" → `/overview` instead of "Find
 * customers" → `/discover`) — it changes a link, never the composition.
 */
export function MarketingHome({ authenticated }: { authenticated: boolean }) {
  const mode = getDataMode();
  const reduced = useReducedMotion();

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

  const variants = entrance(reduced);
  const arrive = arrival(reduced);

  return (
    <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
      {/* ------------------------------------------------------------ hero */}
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
            <span className="t-sys text-text-dim">Decision Intelligence</span>
          </span>
        </motion.div>

        <motion.h1
          variants={arrive}
          className="t-editorial mt-8 max-w-[52rem] text-[clamp(2.6rem,1.3rem+4.6vw,4.75rem)] leading-[1.04] text-balance text-text"
        >
          Most tools buy <span className="t-noise">every lead</span> the same way. ARIE knows
          when to{" "}
          <span className="signal-word align-baseline">
            <span aria-hidden className="signal-word__halo">
              stop.
            </span>
            <span aria-hidden className="signal-word__core">
              stop.
            </span>
            <span aria-hidden className="signal-word__stroke">
              stop.
            </span>
            <span className="sr-only">stop.</span>
          </span>
        </motion.h1>

        <motion.p variants={variants} className="t-lead mt-7 max-w-[34rem] text-pretty">
          Enrichment pipelines call every provider on every lead, then score whatever comes back.
          ARIE buys the cheapest evidence first, keeps buying only while the answer could still
          change, and stops the moment it&apos;s confident enough to decide — or asks a person when
          it isn&apos;t. Every decision ships with a receipt showing exactly why.
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
          <ButtonLink href={authenticated ? "/overview" : "/demo"} variant="primary" size="lg">
            {authenticated ? "Open ARIE" : "Explore interactive demo"}
            <ArrowRight
              className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-0.5"
              strokeWidth={2.5}
            />
          </ButtonLink>
          <ButtonLink href={GITHUB_URL} variant="secondary" size="lg">
            View on GitHub
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.25} />
          </ButtonLink>
        </motion.div>

        <motion.p variants={variants} className="mt-5 text-[0.8125rem] text-text-faint">
          {mode === "mock"
            ? "You're in demo mode — everything works, nothing is billed."
            : "No account needed. Simulated providers, modelled cost — clearly labelled throughout."}
        </motion.p>

        <motion.div variants={arrive} className="mt-16 w-full sm:mt-20">
          <ReceiptFrame />
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
            Evidence has a price and a decision has a deadline. ARIE spends only while spending is
            still doing work — and shows the reasoning either way.
          </p>
        </motion.div>

        <StoppingStory />
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
            <h2 className="t-h2 mt-3 text-balance text-text">Three outcomes, no sign-in.</h2>
            <p className="mt-4 text-[1.0313rem] leading-relaxed text-text-dim">
              Frozen sample data, the real receipt components, and the full reasoning either way —
              including the one where ARIE decides it shouldn&apos;t act alone.
            </p>
          </div>
          <DemoSteps />
        </motion.div>

        <div className="mt-12">
          <DemoCards />
        </div>
      </section>

      {/* ---------------------------------------------- secondary capability */}
      <motion.section
        variants={variants}
        initial="hidden"
        whileInView="show"
        viewport={REVEAL_VIEWPORT}
        className="border-t border-white/[0.05] py-20 sm:py-24"
      >
        <div className="liquid-surface liquid-edge flex flex-col items-start justify-between gap-6 rounded-[1.75rem] p-7 sm:flex-row sm:items-center sm:p-9">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-machine-dim text-machine ring-1 ring-machine-edge/60 ring-inset">
              <Search aria-hidden className="h-5 w-5" strokeWidth={2} />
            </span>
            <div className="max-w-lg">
              <p className="t-sys text-text-faint">Also built in</p>
              <h3 className="mt-1 text-[1.1875rem] font-semibold tracking-[-0.02em] text-text">
                ARIE can also find who to call
              </h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-text-dim">
                The same evidence discipline pointed upstream: describe who you sell to, and ARIE
                screens the market before it spends a cent, verifying each survivor against its
                own website rather than a purchased list.
              </p>
            </div>
          </div>
          <ButtonLink href="/discover" variant="secondary" size="md" className="shrink-0">
            Find customers
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} />
          </ButtonLink>
        </div>
      </motion.section>

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
          Most tools ask which provider to call next. ARIE asks whether to{" "}
          <span className="signal-word align-baseline">
            <span aria-hidden className="signal-word__halo">
              call at all.
            </span>
            <span aria-hidden className="signal-word__core">
              call at all.
            </span>
            <span aria-hidden className="signal-word__stroke">
              call at all.
            </span>
            <span className="sr-only">call at all.</span>
          </span>
        </motion.p>
      </section>
    </div>
  );
}
