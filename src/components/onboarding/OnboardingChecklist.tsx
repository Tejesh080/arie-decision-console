"use client";

import { useEffect, useState } from "react";
import { Circle, CircleCheck, CircleAlert } from "lucide-react";
import Link from "next/link";
import { getOnboardingStatus } from "@/lib/api/onboarding";
import type { OnboardingStatusResponse } from "@/lib/api/types";
import { isSimulated } from "@/lib/api/providerMode";
import { formatDateTime } from "@/lib/format";
import { Eyebrow, Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";

interface Step {
  key: keyof OnboardingStatusResponse;
  label: string;
  description: string;
  href: string;
  /** Mirrors the backend's own `completed` definition exactly
   * (`icp_configured AND first_upload_completed AND first_batch_processed`)
   * — providers stay optional here because PROVIDER_MODE is simulated. */
  optional?: boolean;
}

const STEPS: Step[] = [
  {
    key: "organization_configured",
    label: "Organization",
    description: "Name, timezone, and company domain are set.",
    href: "/settings",
  },
  {
    key: "icp_configured",
    label: "ICP",
    description: "An active ideal-customer-profile configuration exists.",
    href: "/icp",
  },
  {
    key: "provider_configured",
    label: "Providers",
    description: "At least one BYOK provider credential is configured.",
    href: "/providers",
    optional: true,
  },
  {
    key: "first_upload_completed",
    label: "Upload leads",
    description: "A single lead or a CSV batch has been submitted.",
    href: "/batches",
  },
  {
    key: "first_batch_processed",
    label: "First processed batch",
    description: "At least one lead has left the NEW status.",
    href: "/batches",
  },
];

export function OnboardingChecklist() {
  const [status, setStatus] = useState<OnboardingStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getOnboardingStatus()
      .then((result) => {
        if (!cancelled) setStatus(result);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-[800px] px-5 py-10 sm:px-8">
      <header className="mb-8">
        <Eyebrow>Getting started</Eyebrow>
        <h1 className="t-h1 mt-2 text-text">Onboarding</h1>
        <p className="mt-3 max-w-2xl text-[0.9375rem] leading-relaxed text-text-dim">
          What ARIE derives from your organization&apos;s current state — not a workflow you have
          to step through in order.
        </p>
      </header>

      {loadError && (
        <Panel className="mb-6" accent="reject">
          <p className="flex items-center gap-2 text-sm text-text">
            <CircleAlert aria-hidden className="h-4 w-4 shrink-0 text-reject" strokeWidth={2.25} />
            {loadError}
          </p>
        </Panel>
      )}

      {loading ? (
        <p className="text-sm text-text-faint">Loading onboarding status…</p>
      ) : status ? (
        <Panel padding="lg">
          {status.completed && (
            <div className="mb-5 flex items-center gap-2 rounded-md border border-qualify-edge bg-qualify-dim px-3 py-2 text-sm text-qualify">
              <CircleCheck className="h-4 w-4 shrink-0" strokeWidth={2.25} />
              Onboarding complete
              {status.completed_at && ` — ${formatDateTime(status.completed_at)}`}
            </div>
          )}

          <ul className="flex flex-col divide-y divide-border">
            {STEPS.map((step) => {
              const done = Boolean(status[step.key]);
              return (
                <li key={step.key} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex items-start gap-3">
                    {done ? (
                      <CircleCheck
                        className="mt-0.5 h-4.5 w-4.5 shrink-0 text-qualify"
                        strokeWidth={2.25}
                      />
                    ) : (
                      <Circle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-text-faint" strokeWidth={2} />
                    )}
                    <div>
                      <p className="text-sm text-text">
                        {step.label}
                        {step.optional && (
                          <span className="ml-2">
                            <Badge tone="neutral" size="sm">
                              {isSimulated() ? "Optional while simulated" : "Optional"}
                            </Badge>
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-text-faint">{step.description}</p>
                    </div>
                  </div>
                  <Link
                    href={step.href}
                    className="shrink-0 text-xs text-machine hover:underline"
                  >
                    {done ? "View" : "Set up"}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
