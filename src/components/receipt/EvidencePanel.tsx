import type { ReceiptEvidence, ReceiptProviders } from "@/lib/api/types";
import { formatLatency, formatUsd } from "@/lib/format";
import { Eyebrow, Panel } from "@/components/ui/Panel";

/**
 * `providers.called` mixes fresh attempts and cache reuses — the backend
 * distinguishes them only via each call's `cache_hit` flag. This panel
 * never reports a bare "N providers called"; it always splits fresh vs.
 * cache vs. not-called, and never claims a not-called provider was
 * individually evaluated and rejected (the backend's own `not_called`
 * comment: a set difference, not a reasoned skip).
 */
export function EvidencePanel({
  providers,
  evidence,
}: {
  providers: ReceiptProviders;
  evidence: ReceiptEvidence;
}) {
  const fresh = providers.called.filter((c) => !c.cache_hit);
  const cached = providers.called.filter((c) => c.cache_hit);

  return (
    <Panel>
      <Eyebrow>Evidence</Eyebrow>
      <h3 className="mt-1 font-display text-lg font-medium text-text">Provider activity</h3>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <ProviderGroup
          title={`Fresh calls (${fresh.length})`}
          tone="machine"
          items={fresh.map(
            (c) => `${c.provider} · ${formatUsd(c.cost_usd)} · ${formatLatency(c.latency_ms)}`,
          )}
          empty="None this run"
        />
        <ProviderGroup
          title={`Cache reuse (${cached.length})`}
          tone="qualify"
          items={cached.map((c) => `${c.provider} · reused, $0`)}
          empty="None this run"
        />
        <ProviderGroup
          title={`Not called (${providers.not_called.length})`}
          tone="neutral"
          items={providers.not_called}
          empty="All providers were called"
          footnote={
            providers.not_called.length > 0
              ? "Not evaluated and rejected — simply not reached before ARIE stopped."
              : undefined
          }
        />
      </div>

      {evidence.items.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-medium text-text-dim">Known fields, by winning source</p>
          <div className="mt-2 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[0.7rem] uppercase tracking-wider text-text-faint">
                  <th className="px-3 py-2 font-medium">Field</th>
                  <th className="px-3 py-2 font-medium">Source</th>
                  <th className="px-3 py-2 font-medium">Confidence</th>
                  <th className="px-3 py-2 font-medium">Contested</th>
                </tr>
              </thead>
              <tbody>
                {evidence.items.map((item) => (
                  <tr key={item.field} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-data text-xs text-text">{item.field}</td>
                    <td className="px-3 py-2 font-data text-xs text-text-dim">{item.source}</td>
                    <td className="px-3 py-2 font-data text-xs tabular-nums text-text-dim">
                      {(item.confidence * 100).toFixed(0)}%
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {item.contested ? (
                        <span className="text-human">yes</span>
                      ) : (
                        <span className="text-text-faint">no</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {evidence.unknown_fields.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-text-dim">Unknown when the decision was made</p>
          <p className="mt-1.5 flex flex-wrap gap-1.5">
            {evidence.unknown_fields.map((field) => (
              <span
                key={field}
                className="rounded-md bg-panel-2 px-2 py-0.5 font-data text-xs text-text-faint"
              >
                {field}
              </span>
            ))}
          </p>
        </div>
      )}
    </Panel>
  );
}

function ProviderGroup({
  title,
  tone,
  items,
  empty,
  footnote,
}: {
  title: string;
  tone: "machine" | "qualify" | "neutral";
  items: string[];
  empty: string;
  footnote?: string;
}) {
  const dot =
    tone === "machine" ? "bg-machine" : tone === "qualify" ? "bg-qualify" : "bg-text-faint";
  return (
    <div className="rounded-lg border border-border bg-bg-raised p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-text-dim">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {title}
      </p>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-text-faint">{empty}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1">
          {items.map((item) => (
            <li key={item} className="font-data text-xs text-text-dim">
              {item}
            </li>
          ))}
        </ul>
      )}
      {footnote && <p className="mt-2 text-[0.65rem] italic text-text-faint">{footnote}</p>}
    </div>
  );
}
