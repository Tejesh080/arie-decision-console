import { getDataMode } from "@/lib/api/mode";
import { getProviderMode } from "@/lib/api/providerMode";

/**
 * Runtime status, as metadata rather than branding. This replaces what used
 * to be a bright "Demo mode" / "Mock data" pill sitting beside primary
 * navigation on every screen — true information, but placed like a product
 * claim instead of a technical detail. It says the same true things now,
 * but only to someone who opens a secondary disclosure looking for them.
 *
 * Every line here is something the frontend can actually verify or has been
 * told outright — nothing is upgraded to "live" just because it would sound
 * better. Discovery and buyer lookup can use real providers independently of
 * the legacy enrichment pipeline's mode, and the frontend has no API that
 * proves whether their keys are configured, so those two rows deliberately
 * don't claim a live/simulated state at all.
 */
export function SystemStatus() {
  const mode = getDataMode();
  const providerMode = getProviderMode();

  return (
    <div className="mt-1 border-t border-white/[0.06] px-3 pt-2.5 pb-2">
      <p className="t-sys text-text-faint">System status</p>
      <dl className="mt-2 flex flex-col gap-1.5">
        <StatusRow label="Data source" value={mode === "mock" ? "Mock data" : "Live API"} />
        <StatusRow label="Discovery evidence" value="Provider-backed when configured" />
        <StatusRow label="Buyer lookup" value="Provider-backed when configured" />
        <StatusRow
          label="Legacy enrichment"
          value={providerMode === "simulated" ? "Simulated" : "Live"}
        />
        <StatusRow label="Autonomous execution" value="Off" />
      </dl>
      {providerMode === "simulated" && (
        <p className="mt-2.5 text-[0.6875rem] leading-relaxed text-text-faint">
          Legacy enrichment replays a frozen evaluation corpus — no vendor is called, and cost
          figures are modelled at configured rates. The queue, worker, scoring, and review
          workflow around it are real.
        </p>
      )}
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
