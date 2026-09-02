import type { DiscoveryFunnel } from "@/lib/api/types";
import { Eyebrow } from "@/components/ui/Panel";

/**
 * "How did N possibilities become these opportunities?" — the metric the
 * pivot brief calls out as the one that actually matters. Every figure is
 * read straight off `arie.discovery.models.DiscoveryFunnel`; nothing here is
 * derived or estimated client-side.
 */
export function FunnelSummary({ funnel }: { funnel: DiscoveryFunnel }) {
  const steps = [
    { label: "Search queries", value: funnel.search_queries },
    { label: "Candidates found", value: funnel.raw_candidates },
    { label: "Unique companies", value: funnel.unique_companies },
    { label: "Screened promising", value: funnel.promising + funnel.possible },
    { label: "Promoted", value: funnel.promoted_to_leads },
    { label: "Opportunities", value: funnel.final_opportunities },
  ];

  return (
    <div className="surface-flat grid grid-cols-3 divide-border sm:grid-cols-6 sm:divide-x">
      {steps.map((step, i) => (
        <div
          key={step.label}
          className={i < 3 ? "border-b border-border p-4 sm:border-b-0" : "p-4"}
        >
          <Eyebrow>{step.label}</Eyebrow>
          <p className="t-metric mt-1.5 text-xl text-text">{step.value}</p>
        </div>
      ))}
    </div>
  );
}
