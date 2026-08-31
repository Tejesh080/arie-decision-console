"use client";

import { useEffect, useState } from "react";
import { CircleAlert } from "lucide-react";
import { listProviders } from "@/lib/api/providers";
import type { ProviderStatusResponse } from "@/lib/api/types";
import { Eyebrow, Panel } from "@/components/ui/Panel";
import { ProviderCard } from "./ProviderCard";

export function ProvidersView({ canEdit }: { canEdit: boolean }) {
  const [providers, setProviders] = useState<ProviderStatusResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listProviders()
      .then((result) => {
        if (!cancelled) setProviders(result);
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
    <div className="mx-auto max-w-[900px] px-5 py-10 sm:px-8">
      <header className="mb-8">
        <Eyebrow>Providers</Eyebrow>
        <h1 className="t-h1 mt-2 text-text">Provider credentials (BYOK)</h1>
        <p className="mt-3 max-w-2xl text-[0.9375rem] leading-relaxed text-text-dim">
          Each credential is stored in Supabase Vault, scoped to this organization only — no other
          organization can read or resolve it. A configured provider isn&apos;t used for live
          acquisition yet while this deployment runs in simulated mode.
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
        <p className="text-sm text-text-faint">Loading providers…</p>
      ) : (
        <div className="flex flex-col gap-5">
          {providers.map((status) => (
            <ProviderCard
              key={status.provider}
              status={status}
              canEdit={canEdit}
              onChanged={(next) =>
                setProviders((prev) =>
                  prev.map((p) => (p.provider === next.provider ? next : p)),
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
