"use client";

import { FlaskConical } from "lucide-react";
import clsx from "clsx";
import { isSimulated } from "@/lib/api/providerMode";
import { Tooltip } from "@/components/ui/Tooltip";

/**
 * The permanent honesty marker.
 *
 * This deployment looks production-real on purpose — real queue, real worker,
 * real persistence, real receipts — which is exactly why it needs a standing
 * statement that *provider acquisition* is simulated. Without it a visitor can
 * reasonably read "$0.407 modeled cost" as money someone was billed.
 *
 * Deliberately a quiet chip rather than a banner: a warning strip across the
 * top would say "this is broken", when the correct message is "this part is
 * simulated and everything around it isn't". Renders nothing at all when the
 * backend is pointed at live providers, so it can never become a stale claim.
 */
export function DemoModeChip({ className }: { className?: string }) {
  if (!isSimulated()) return null;

  return (
    <Tooltip
      align="end"
      className={className}
      label={
        <>
          <strong className="font-medium text-text">What&apos;s simulated:</strong> provider
          acquisition only. Enrichment replays a frozen evaluation corpus, so no vendor is called
          and no money is spent — the cost figures are modelled at configured provider rates.
          <br />
          <br />
          <strong className="font-medium text-text">What&apos;s real:</strong> the Postgres job
          queue, the worker, persistence, scoring, the confidence model, Decision Receipts, the
          human-review workflow, and the n8n orchestration around it.
        </>
      }
    >
      <span
        className={clsx(
          "inline-flex items-center gap-1.5 rounded-full border border-border-strong",
          "bg-surface/70 px-2 py-1 backdrop-blur-sm transition-colors hover:border-border-loud sm:px-2.5",
        )}
      >
        <FlaskConical aria-hidden className="h-3 w-3 shrink-0 text-text-dim" strokeWidth={2} />
        {/* Below `sm` the header has no room for this and the nav, and the
            nav wins. The icon alone still marks the page, and the tooltip
            still opens on tap.

            The chip deliberately says only "Demo mode": the full statement
            of what is and isn't simulated lives in the tooltip. Spelling
            "simulated providers · modelled cost" across the header put the
            most engineering-shaped sentence in the product in the most
            prominent chrome on every screen. */}
        <span className="hidden text-[0.75rem] font-medium text-text-dim sm:inline">Demo mode</span>
        <span className="sr-only">Demo mode — simulated provider acquisition, modelled costs</span>
      </span>
    </Tooltip>
  );
}
