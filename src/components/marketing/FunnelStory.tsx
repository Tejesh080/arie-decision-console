"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import clsx from "clsx";
import { REVEAL_VIEWPORT, entrance, stagger } from "@/lib/motion";

/**
 * What ARIE actually does, in the order it does it.
 *
 * These four stages are the funnel the backend really reports
 * (`DiscoveryFunnel`: search_queries → screened → website_verified →
 * buyer_found) — a description of the machine, not a marketing abstraction
 * of it. The one liberty taken is colour: each stage is tinted along the
 * app's own signal spectrum, violet through to mint, so the sequence reads
 * as the brand's whole story — noise resolving into signal — without
 * needing another diagram to say so.
 */
const STAGES = [
  {
    n: "01",
    title: "Search the market",
    body: "ARIE turns your targeting profile into real search queries and pulls back the companies that match — not a static list someone sold you.",
    glyph: "search",
    tone: "#9e86ff",
    dim: "rgba(158,134,255,0.14)",
  },
  {
    n: "02",
    title: "Screen before spending",
    body: "Every candidate gets judged cheaply first. The ones that clearly don't fit are dropped before a single paid lookup happens.",
    glyph: "screen",
    tone: "#6c8cff",
    dim: "rgba(108,140,255,0.14)",
  },
  {
    n: "03",
    title: "Verify on their own site",
    body: "The survivors get checked against what the company says about itself, so the reason to contact them is grounded in evidence you can read.",
    glyph: "verify",
    tone: "#59d8ff",
    dim: "rgba(89,216,255,0.14)",
  },
  {
    n: "04",
    title: "Name the person",
    body: "Then ARIE finds who owns that problem, and tells you what to do next — or says plainly that it couldn't.",
    glyph: "person",
    tone: "#4fe3c1",
    dim: "rgba(79,227,193,0.16)",
    accent: true,
  },
] as const;

function Glyph({ kind, tone }: { kind: string; tone: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden className="h-8 w-8 sm:h-9 sm:w-9">
      {kind === "search" && (
        <>
          {[6, 14, 22, 30].map((x) => (
            <rect key={x} x={x} y="17" width="4" height="4" rx="1" fill={tone} opacity={0.85} />
          ))}
          <rect x="6" y="9" width="4" height="4" rx="1" fill={tone} opacity={0.4} />
          <rect x="22" y="25" width="4" height="4" rx="1" fill={tone} opacity={0.4} />
          <rect x="30" y="9" width="4" height="4" rx="1" fill={tone} opacity={0.4} />
        </>
      )}
      {kind === "screen" && (
        <>
          <rect x="6" y="17" width="4" height="4" rx="1" fill={tone} opacity={0.85} />
          <rect x="14" y="17" width="4" height="4" rx="1" fill={tone} opacity={0.3} />
          <rect x="22" y="17" width="4" height="4" rx="1" fill={tone} opacity={0.85} />
          <rect x="30" y="17" width="4" height="4" rx="1" fill={tone} opacity={0.3} />
          <path d="M20 6v28" stroke={tone} strokeWidth="1.25" strokeDasharray="3 4" opacity={0.6} />
        </>
      )}
      {kind === "verify" && (
        <>
          <path
            d="M8 12h14M8 19h10M8 26h16"
            stroke={tone}
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity={0.6}
          />
          <circle cx="30" cy="26" r="6" stroke={tone} strokeWidth="1.5" opacity={0.85} />
          <path
            d="M27.5 26l2 2 3.5-4"
            stroke={tone}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.9}
          />
        </>
      )}
      {kind === "person" && (
        <>
          <circle cx="20" cy="15" r="5.5" stroke={tone} strokeWidth="1.6" opacity={0.9} />
          <path
            d="M9 32c1.8-5.6 6-8.4 11-8.4S29.2 26.4 31 32"
            stroke={tone}
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity={0.9}
          />
        </>
      )}
    </svg>
  );
}

export function FunnelStory() {
  const reduced = useReducedMotion();
  const variants = entrance(reduced);
  const railRef = useRef<HTMLDivElement>(null);

  // The rail fills with colour as the reader scrolls the sequence — the
  // same "resolving" idea the hero's typography plays with, played out
  // spatially instead. `useScroll` reads real scroll position; it is never
  // driven by a timer, so nothing here fakes progress the reader hasn't
  // actually made.
  const { scrollYProgress } = useScroll({
    target: railRef,
    offset: ["start 0.8", "end 0.55"],
  });
  const fill = useTransform(scrollYProgress, [0, 1], reduced ? [1, 1] : [0, 1]);

  return (
    <div ref={railRef} className="relative mt-20">
      {/* A wide, low wash behind the whole sequence — the section's own
          light, distinct from the hero's but built the same cheap way
          (radial-gradient, no filter). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[-4vw] top-0 -z-10 h-full opacity-70"
        style={{
          background:
            "radial-gradient(640px 420px at 8% 8%, rgba(158,134,255,0.10), transparent 68%)," +
            "radial-gradient(640px 460px at 92% 42%, rgba(89,216,255,0.09), transparent 68%)," +
            "radial-gradient(680px 480px at 12% 92%, rgba(79,227,193,0.12), transparent 68%)",
        }}
      />

      <motion.ol
        variants={stagger(0.12)}
        initial="hidden"
        whileInView="show"
        viewport={REVEAL_VIEWPORT}
        className="relative flex flex-col"
      >
        {/* Base rail — always visible, quiet. */}
        <span
          aria-hidden
          className="absolute top-2 bottom-2 left-[23px] w-px bg-border-strong sm:left-[31px]"
        />
        {/* Fill rail — grows with real scroll progress, transform-origin
            pinned to the top so it reads as light travelling down the
            sequence rather than a bar just appearing. */}
        <motion.span
          aria-hidden
          style={{ scaleY: fill, transformOrigin: "top" }}
          className="absolute top-2 bottom-2 left-[23px] w-px sm:left-[31px]"
        >
          <span
            className="block h-full w-full"
            style={{
              background:
                "linear-gradient(180deg, #9e86ff, #6c8cff 34%, #59d8ff 64%, var(--qualify) 100%)",
              boxShadow: "0 0 12px 0 rgba(79,227,193,0.35)",
            }}
          />
        </motion.span>

        {STAGES.map((stage) => {
          const accent = "accent" in stage && stage.accent;
          return (
            <motion.li
              key={stage.n}
              variants={variants}
              className="group relative flex gap-6 py-10 sm:gap-9 sm:py-14"
            >
              {/* Ghost numeral — the bespoke editorial flourish repeated
                  from the hero, at ambient scale, never competing with the
                  real content in front of it. */}
              <span
                aria-hidden
                className="t-editorial pointer-events-none absolute top-1/2 right-0 -z-10 hidden -translate-y-1/2 text-[7rem] leading-none text-transparent select-none sm:block lg:text-[9rem]"
                style={{ WebkitTextStroke: `1px ${stage.dim}` }}
              >
                {stage.n}
              </span>

              <div className="relative shrink-0">
                <span
                  aria-hidden
                  className="absolute inset-[-14px] -z-10 rounded-full opacity-70 transition-opacity duration-500 group-hover:opacity-100"
                  style={{ background: `radial-gradient(circle, ${stage.dim}, transparent 72%)` }}
                />
                <span
                  className={clsx(
                    "liquid-surface liquid-edge relative flex h-16 w-16 items-center justify-center rounded-2xl transition-transform duration-500 ease-out group-hover:-translate-y-1 group-hover:scale-[1.04] sm:h-20 sm:w-20",
                    accent && "spectral-edge",
                  )}
                >
                  <Glyph kind={stage.glyph} tone={stage.tone} />
                </span>
              </div>

              <div className="min-w-0 flex-1 border-b border-white/[0.05] pb-10 sm:pb-14 group-last:border-b-0 group-last:pb-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="t-sys" style={{ color: stage.tone }}>
                    {stage.n}
                  </span>
                  <h3
                    className={clsx(
                      "text-[1.375rem] font-semibold tracking-[-0.024em] sm:text-[1.75rem]",
                      accent ? "text-qualify" : "text-text",
                    )}
                  >
                    {stage.title}
                  </h3>
                </div>
                <p className="mt-3 max-w-xl text-[1rem] leading-relaxed text-text-dim sm:text-[1.0625rem]">
                  {stage.body}
                </p>
              </div>
            </motion.li>
          );
        })}
      </motion.ol>
    </div>
  );
}
