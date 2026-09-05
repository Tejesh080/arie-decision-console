import { getDataMode } from "@/lib/api/mode";

/**
 * Runtime status, as metadata rather than branding. This replaces what used
 * to be a bright "Demo mode" / "Mock data" pill sitting beside primary
 * navigation on every screen — true information, but placed like a product
 * claim instead of a technical detail. It says the same true things now,
 * but only to someone who opens a secondary disclosure looking for them.
 *
 * Only "Data source" is asserted as a fact: `getDataMode()` reflects this
 * build's actual wiring (mock vs. real API), so the frontend genuinely knows
 * it. Everything else here is explicitly *not* claimed as live/simulated —
 * deliberately, not as an oversight.
 *
 * `NEXT_PUBLIC_ARIE_PROVIDER_MODE` (what `getProviderMode()`/`isSimulated()`
 * read) is a frontend build-time presentation flag, not a query against the
 * backend's actual `PROVIDER_MODE` — the two are set independently and can
 * drift out of sync without either side knowing. Using it here to assert
 * "Legacy enrichment: Simulated" would present a guess as verified backend
 * state. The existing modelled-cost captions elsewhere (receipts, evidence
 * panels) are a different, narrower thing: a caveat on one displayed number
 * ("if this was simulated, here's what the figure means"), not a standalone
 * claim about the system's current execution mode — those stay as they are.
 * Discovery/buyer-lookup provider status and the autonomous-execution
 * invariant are exactly as unverifiable from here, so all three read
 * "Backend-controlled" rather than a fabricated Live/Simulated/Off.
 */
export function SystemStatus() {
  const mode = getDataMode();

  return (
    <div className="mt-1 border-t border-white/[0.06] px-3 pt-2.5 pb-2">
      <p className="t-sys text-text-faint">System status</p>
      <dl className="mt-2 flex flex-col gap-1.5">
        <StatusRow label="Data source" value={mode === "mock" ? "Mock data" : "Live API"} />
        <StatusRow label="Discovery providers" value="Backend-configured" />
        <StatusRow label="Buyer lookup" value="Backend-configured" />
        <StatusRow label="Legacy enrichment" value="Backend-controlled" />
        <StatusRow label="Autonomous execution" value="Backend-controlled" />
      </dl>
      <p className="mt-2.5 text-[0.6875rem] leading-relaxed text-text-faint">
        Execution mode and provider configuration are controlled by the backend, not by this
        app&apos;s build settings.
      </p>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[0.75rem]">
      <dt className="text-text-faint">{label}</dt>
      <dd className="text-text-dim">{value}</dd>
    </div>
  );
}
