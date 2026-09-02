"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Panel, Eyebrow } from "@/components/ui/Panel";

const STAGES = [
  "Searching the market",
  "Screening companies",
  "Researching only where needed",
  "Building your shortlist",
] as const;

/**
 * `POST /discovery/runs` runs synchronously and returns only once the whole
 * loop is finished — there is no server-sent progress to render. This is a
 * paced, honest stand-in: generic stage labels with no fabricated counts,
 * cycling while the request is in flight, however long it actually takes.
 * The real numbers only ever appear once the run has actually completed.
 */
export function DiscoveryProgress() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStage((s) => Math.min(s + 1, STAGES.length - 1));
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    <Panel className="mt-8" padding="lg">
      <Eyebrow>Finding opportunities…</Eyebrow>
      <ul className="mt-4 flex flex-col gap-2.5">
        {STAGES.map((label, i) => (
          <li key={label} className="flex items-center gap-2.5 text-sm">
            {i < stage ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-qualify" strokeWidth={2} />
            ) : i === stage ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-machine" strokeWidth={2.25} />
            ) : (
              <span
                aria-hidden
                className="h-4 w-4 shrink-0 rounded-full border border-border-strong"
              />
            )}
            <span className={i <= stage ? "text-text" : "text-text-faint"}>{label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-text-faint">
        This can take a little while — ARIE only spends on the companies worth it.
      </p>
    </Panel>
  );
}
