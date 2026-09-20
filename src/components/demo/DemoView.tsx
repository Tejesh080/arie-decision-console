"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { CircleCheck, Eye, UserRoundCheck } from "lucide-react";
import { DEMO_SCENARIOS, findDemoScenario, type DemoScenarioId } from "@/lib/demo/scenarios";
import { Wordmark } from "@/components/brand/Mark";
import { DemoModeBanner } from "@/components/demo/DemoModeBanner";
import { DemoReceiptView } from "@/components/demo/DemoReceiptView";

const TAB_ICON = {
  confident: CircleCheck,
  review: UserRoundCheck,
  shadow: Eye,
} as const;

const TAB_TONE: Record<DemoScenarioId, string> = {
  confident: "text-qualify",
  review: "text-human",
  shadow: "text-shadow-role",
};

/**
 * `/demo`'s whole body. A visitor lands here with no session and no cookies
 * — see `middleware.ts`'s `onDemoPage` exemption and `src/app/demo/page.tsx`
 * — and can flip between the three outcomes ARIE can reach without ever
 * going near a form or a backend call. Picking a scenario is local
 * component state, not a route param or a fetch: the whole point is that
 * this page never leaves the client with three frozen objects already in
 * hand (`src/lib/demo/scenarios.ts`).
 */
export function DemoView() {
  // `?scenario=` lets a link (DemoCards on the homepage) deep-link straight
  // into one outcome; an unknown or absent value falls back to the first
  // scenario rather than erroring — this page never has a "not found" state.
  const searchParams = useSearchParams();
  const requested = findDemoScenario(searchParams.get("scenario"));
  const [activeId, setActiveId] = useState<DemoScenarioId>((requested ?? DEMO_SCENARIOS[0]).id);
  const active = DEMO_SCENARIOS.find((s) => s.id === activeId) ?? DEMO_SCENARIOS[0];

  return (
    <>
      <DemoModeBanner />
      <main id="content" className="relative z-0 flex-1">
        <div className="mx-auto max-w-[1200px] px-5 py-10 sm:px-8 sm:py-12">
          <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
            <Link href="/" aria-label="ARIE, back to the homepage" className="shrink-0">
              <Wordmark />
            </Link>
            <Link
              href="/login"
              className="text-xs text-text-faint transition-colors hover:text-text-dim"
            >
              Sign in →
            </Link>
          </header>

          <div className="mt-8 max-w-2xl">
            <p className="t-label text-text-faint">Live demo</p>
            <h1 className="t-h1 mt-2 text-text">Three outcomes, no sign-in required</h1>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-text-dim">
              ARIE gathers evidence until it has enough to make a confident recommendation, then
              routes the lead, asks a human, or — in shadow mode — watches without acting. These
              three receipts are frozen sample data, not a live run: pick one to see the same
              components a signed-in customer sees on a real lead.
            </p>
          </div>

          {/* ------------------------------------------------- scenario switcher */}
          <div
            role="tablist"
            aria-label="Demo scenario"
            className="mt-7 flex flex-wrap gap-2 border-b border-border pb-5"
          >
            {DEMO_SCENARIOS.map((scenario) => {
              const Icon = TAB_ICON[scenario.id];
              const isActive = scenario.id === activeId;
              return (
                <button
                  key={scenario.id}
                  type="button"
                  role="tab"
                  id={`demo-tab-${scenario.id}`}
                  aria-selected={isActive}
                  aria-controls={`demo-panel-${scenario.id}`}
                  onClick={() => setActiveId(scenario.id)}
                  className={clsx(
                    "flex items-center gap-2 rounded-full border px-4 py-2 text-left text-sm font-medium transition-colors duration-150",
                    isActive
                      ? "border-border-loud bg-surface-2 text-text"
                      : "border-border bg-bg-sunken text-text-dim hover:border-border-loud hover:text-text",
                  )}
                >
                  <Icon
                    aria-hidden
                    className={clsx("h-4 w-4 shrink-0", isActive && TAB_TONE[scenario.id])}
                    strokeWidth={2.25}
                  />
                  <span>
                    {scenario.label}
                    <span className="ml-1.5 hidden text-xs font-normal text-text-faint sm:inline">
                      · {scenario.outcome}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-text-dim">{active.blurb}</p>

          <div
            role="tabpanel"
            id={`demo-panel-${active.id}`}
            aria-labelledby={`demo-tab-${active.id}`}
            className="mt-6"
          >
            <DemoReceiptView key={active.id} scenario={active} />
          </div>
        </div>
      </main>
    </>
  );
}
