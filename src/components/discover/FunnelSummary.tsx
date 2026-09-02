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
    { label: "Website verified", value: funnel.website_verified },
    { label: "Promoted", value: funnel.promoted_to_leads },
    { label: "Opportunities", value: funnel.final_opportunities },
    { label: "Contactable", value: funnel.final_contactable_opportunities, emphasize: true },
  ];

  return (
    <div className="surface-flat grid grid-cols-2 divide-border sm:grid-cols-4 sm:divide-x">
      {steps.map((step, i) => (
        <div
          key={step.label}
          className={i < 4 ? "border-b border-border p-4 sm:border-b-0" : "p-4"}
        >
          <Eyebrow>{step.label}</Eyebrow>
          <p className={`t-metric mt-1.5 text-xl ${step.emphasize ? "text-qualify" : "text-text"}`}>
            {step.value}
          </p>
        </div>
      ))}
      <p className="col-span-2 border-t border-border px-4 py-2.5 text-[0.6875rem] leading-relaxed text-text-faint sm:col-span-4">
        Contactable means a positive company, a named buyer, and a verified or likely email — the
        real measure of what this run was worth, not just a count of companies.
      </p>
    </div>
  );
}
