"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { ArrowRight } from "lucide-react";
import { getDataMode } from "@/lib/api/mode";
import { Eyebrow } from "@/components/ui/Panel";
import { ButtonLink } from "@/components/ui/Button";
import { Mark } from "@/components/brand/Mark";
import { HeroAurora } from "@/components/graphics/HeroAurora";
import { ProductFrame } from "@/components/graphics/ProductFrame";
import { AnimatedGridPattern } from "@/components/graphics/AnimatedGridPattern";
import { FunnelStory } from "@/components/marketing/FunnelStory";
import { DemoCards, DemoSteps } from "@/components/dashboard/DemoCards";
import { REVEAL_VIEWPORT, arrival, entrance, stagger } from "@/lib/motion";

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
          reason to care, verifies what it finds on their own site, and names the person who owns
          the problem — evidence attached.
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
          {authenticated ? (
            <ButtonLink href="/overview" variant="primary" size="lg">
              Open ARIE
              <ArrowRight
                className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-0.5"
                strokeWidth={2.5}
              />
            </ButtonLink>
          ) : (
            <ButtonLink href="/discover" variant="primary" size="lg">
              Find customers
              <ArrowRight
                className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-0.5"
                strokeWidth={2.5}
              />
            </ButtonLink>
          )}
          <ButtonLink href="/demo" variant="secondary" size="lg">
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
    </div>
  );
}
