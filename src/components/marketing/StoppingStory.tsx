"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import clsx from "clsx";
import { REVEAL_VIEWPORT, entrance, stagger } from "@/lib/motion";

/**
 * What ARIE actually does to a single lead, in the order it does it.
 *
 * These four stages are the real stopping policy (`arie.policy` /
 * `_acquire_live_evidence`: buy cheapest-first, check `is_settled`, check
 * confidence against tau, otherwise buy the next one) — a description of
 * the machine, not a marketing abstraction of it. Colour and layout are
 * lifted directly from `FunnelStory` (the discovery-funnel version of this
 * same component) so the two tell visually-consistent stories; this one is
 * the primary narrative, that one is now secondary.
 */
const STAGES = [
  {
    n: "01",
    title: "Buy the cheapest evidence first",
    body: "Company firmographics before a per-person lookup, cache before a fresh call — the same identity resolved twice never pays twice.",
    glyph: "buy",
    tone: "#9e86ff",
    dim: "rgba(158,134,255,0.14)",
  },
  {
    n: "02",
    title: "Ask if anything left could still change it",
    body: "Given what's unknown, could the best or worst case of the next purchase actually move the outcome? If not, no amount of extra evidence is worth paying for.",
    glyph: "settle",
    tone: "#6c8cff",
    dim: "rgba(108,140,255,0.14)",
  },
  {
    n: "03",
    title: "Stop when confidence clears the bar",
    body: "A calibrated model, not a guess — checked against an autonomy threshold derived from a statistical bound, not the raw pass rate on a small sample.",
    glyph: "threshold",
    tone: "#59d8ff",
    dim: "rgba(89,216,255,0.14)",
  },
  {
    n: "04",
    title: "Route it, or ask a person",
    body: "Confident enough, ARIE acts alone. Short of the bar, it stops and hands the lead to a reviewer instead of guessing — either way, a receipt records exactly why.",
    glyph: "route",
    tone: "#4fe3c1",
    dim: "rgba(79,227,193,0.16)",
    accent: true,
  },
] as const;

function Glyph({ kind, tone }: { kind: string; tone: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden className="h-8 w-8 sm:h-9 sm:w-9">
      {kind === "buy" && (
        <>
          <circle cx="14" cy="14" r="7" stroke={tone} strokeWidth="1.6" opacity={0.9} />
          <circle cx="14" cy="14" r="2" fill={tone} opacity={0.85} />
          {[22, 27, 32].map((x, i) => (
            <circle key={x} cx={x} cy={26} r="4.5" stroke={tone} strokeWidth="1.4" opacity={0.4 - i * 0.08} />
          ))}
        </>
      )}
      {kind === "settle" && (
        <>
          <path d="M8 30V16l12-10 12 10v14" stroke={tone} strokeWidth="1.5" opacity={0.5} strokeLinejoin="round" />
          <path d="M14 30v-9h12v9" stroke={tone} strokeWidth="1.6" opacity={0.9} strokeLinejoin="round" />
          <circle cx="20" cy="12" r="2.4" fill={tone} opacity={0.9} />
        </>
      )}
      {kind === "threshold" && (
        <>
          <path d="M6 30h28" stroke={tone} strokeWidth="1.4" opacity={0.35} strokeLinecap="round" />
          <path d="M6 30V13" stroke={tone} strokeWidth="1.6" opacity={0.85} strokeLinecap="round" />
          <path
            d="M6 22c4-9 9-13 14-13s10 4 14 13"
            stroke={tone}
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity={0.9}
          />
          <path d="M23 6v9" stroke={tone} strokeWidth="1.4" strokeDasharray="2.5 3" opacity={0.6} />
        </>
      )}
      {kind === "route" && (
        <>
          <circle cx="10" cy="20" r="4" stroke={tone} strokeWidth="1.6" opacity={0.85} />
          <path d="M14 20h9" stroke={tone} strokeWidth="1.6" opacity={0.7} strokeLinecap="round" />
          <path d="M27 13l6 7-6 7" stroke={tone} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
        </>
      )}
    </svg>
  );
}

export function StoppingStory() {
  const reduced = useReducedMotion();
  const variants = entrance(reduced);
  const railRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: railRef,
    offset: ["start 0.8", "end 0.55"],
  });
  const fill = useTransform(scrollYProgress, [0, 1], reduced ? [1, 1] : [0, 1]);

  return (
    <div ref={railRef} className="relative mt-20">
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
        <span
          aria-hidden
          className="absolute top-2 bottom-2 left-[23px] w-px bg-border-strong sm:left-[31px]"
        />
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
