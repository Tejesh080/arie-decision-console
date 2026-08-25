import { CircleAlert, CircleCheck, CircleMinus, Clock, Database, Zap } from "lucide-react";
import clsx from "clsx";
import type { ProviderCallStatus, ReceiptEvidence, ReceiptProviders } from "@/lib/api/types";
import { formatLatency, formatUsd } from "@/lib/format";
import { callNoun, isSimulated } from "@/lib/api/providerMode";
import { Eyebrow, Panel } from "@/components/ui/Panel";

/**
 * The provider ledger.
 *
 * `providers.called` mixes three orthogonal facts that this panel keeps
 * separate, because collapsing any pair of them produces a false statement:
 *
 *   - `cache_hit`  — was this reused, or newly acquired?
 *   - `status`     — did the call return data, return nothing, or fail?
 *   - `cost_usd`   — what did it cost, whether or not it returned anything?
 *
 * That last combination is the one worth designing for: a provider can be
 * charged for and still return nothing (`status: "miss"` with a non-zero
 * cost), and a provider can fail outright (`status: "error"`). Reporting a
 * bare "N providers called" would hide both.
 *
 * `not_called` is a set difference against the catalogue — never rendered as
 * a reasoned skip, because the backend does not claim it was one.
 */

const RESULT: Record<
  ProviderCallStatus,
  { label: string; icon: typeof CircleCheck; className: string; hint: string }
> = {
  success: {
    label: "Returned data",
    icon: CircleCheck,
    className: "text-qualify",
    hint: "Responded with usable evidence",
  },
  miss: {
    label: "No data",
    icon: CircleMinus,
    className: "text-text-faint",
    hint: "Responded, but held nothing for this lead",
  },
  error: {
    label: "Failed",
    icon: CircleAlert,
    className: "text-reject",
    hint: "The call errored",
  },
  timeout: {
    label: "Timed out",
    icon: Clock,
    className: "text-human",
    hint: "The call did not return in time",
  },
};

export function EvidencePanel({
  providers,
  evidence,
}: {
  providers: ReceiptProviders;
  evidence: ReceiptEvidence;
}) {
  const fresh = providers.called.filter((c) => !c.cache_hit);
  const cached = providers.called.filter((c) => c.cache_hit);
  const notCalled = providers.not_called;
  const total = fresh.length + cached.length + notCalled.length;

  // Worth calling out explicitly: money spent on a provider that returned
  // nothing is exactly the waste ARIE exists to avoid, so it should never be
  // something the reader has to reconstruct from a table.
  const paidForNothing = providers.called.filter(
    (c) => c.status !== "success" && Number.parseFloat(c.cost_usd) > 0,
  );
  const failures = providers.called.filter((c) => c.status === "error" || c.status === "timeout");

  return (
    <Panel as="section">
      <Eyebrow>Evidence</Eyebrow>
      <h2 className="t-h3 mt-1.5 text-text">Provider ledger</h2>

      {/* Segmented acquisition bar: the shape of this run at a glance. */}
      {total > 0 && (
        <div
          className="mt-4 flex h-1.5 gap-0.5 overflow-hidden rounded-full"
          role="img"
          aria-label={`${fresh.length} providers acquired fresh, ${cached.length} reused from cache, ${notCalled.length} not called`}
        >
          {fresh.length > 0 && <span className="bg-machine" style={{ flexGrow: fresh.length }} />}
          {cached.length > 0 && <span className="bg-qualify" style={{ flexGrow: cached.length }} />}
          {notCalled.length > 0 && (
            <span className="bg-surface-3" style={{ flexGrow: notCalled.length }} />
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        <LegendItem icon={Zap} className="text-machine" label={`Fresh calls (${fresh.length})`} />
        <LegendItem
          icon={Database}
          className="text-qualify"
          label={`Cache reuse (${cached.length})`}
        />
        <LegendItem
          icon={CircleMinus}
          className="text-text-faint"
          label={`Not called (${notCalled.length})`}
        />
      </div>

      {/* --------------------------------------------------------- ledger */}
      {providers.called.length === 0 ? (
        <p className="mt-5 rounded-md border border-border bg-bg-sunken px-4 py-3 text-sm text-text-faint">
          None this run — no provider was reached before ARIE stopped.
        </p>
      ) : (
        <>
          {/* Below `sm` the same rows render as stacked cards -- a five-column
            ledger in a 350px viewport is three columns permanently offscreen. */}
          <ul className="mt-5 flex flex-col gap-2 sm:hidden">
            {providers.called.map((call) => {
              const result = RESULT[call.status] ?? RESULT.miss;
              const Icon = result.icon;
              const cost = Number.parseFloat(call.cost_usd);
              return (
                <li
                  key={`m-${call.provider}-${call.cache_hit}-${call.latency_ms}`}
                  className="rounded-md border border-border bg-bg-sunken p-3"
                >
                  <p className="t-data text-text">{call.provider}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                    <span className={clsx("flex items-center gap-1.5", result.className)}>
                      <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={2.25} />
                      {result.label}
                    </span>
                    <span
                      className={clsx(
                        "flex items-center gap-1.5",
                        call.cache_hit ? "text-qualify" : "text-machine",
                      )}
                    >
                      {call.cache_hit ? (
                        <Database aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                      ) : (
                        <Zap aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                      )}
                      {call.cache_hit ? "Cached" : "Fresh"}
                    </span>
                  </p>
                  <p className="mt-2 flex items-center justify-between border-t border-border pt-2">
                    <span className="t-data text-text-faint">
                      {call.cache_hit ? "—" : formatLatency(call.latency_ms)}
                    </span>
                    <span className={clsx("t-data", cost > 0 ? "text-text" : "text-text-faint")}>
                      {formatUsd(call.cost_usd)}
                    </span>
                  </p>
                </li>
              );
            })}
          </ul>

          <div className="scroll-x mt-5 hidden rounded-md border border-border sm:block">
            <table className="w-full min-w-[34rem] border-collapse text-left">
              <caption className="sr-only">
                Every provider interaction in this run, with its result, source, latency and cost
              </caption>
              <thead>
                <tr className="border-b border-border bg-bg-sunken">
                  <Th>Provider</Th>
                  <Th>Result</Th>
                  <Th>Source</Th>
                  <Th align="right">Latency</Th>
                  <Th align="right">{isSimulated() ? "Modeled cost" : "Cost"}</Th>
                </tr>
              </thead>
              <tbody>
                {providers.called.map((call) => {
                  const result = RESULT[call.status] ?? RESULT.miss;
                  const Icon = result.icon;
                  const cost = Number.parseFloat(call.cost_usd);
                  return (
                    <tr
                      key={`${call.provider}-${call.cache_hit}-${call.latency_ms}`}
                      className="border-b border-border last:border-0"
                    >
                      <td className="t-data px-3 py-2.5 text-text">{call.provider}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={clsx("flex items-center gap-1.5 text-xs", result.className)}
                          title={result.hint}
                        >
                          <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
                          {result.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={clsx(
                            "flex items-center gap-1.5 text-xs",
                            call.cache_hit ? "text-qualify" : "text-machine",
                          )}
                        >
                          {call.cache_hit ? (
                            <Database aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                          ) : (
                            <Zap aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                          )}
                          {call.cache_hit ? "Cached" : "Fresh"}
                        </span>
                      </td>
                      <td className="t-data px-3 py-2.5 text-right text-text-dim">
                        {call.cache_hit ? "—" : formatLatency(call.latency_ms)}
                      </td>
                      <td
                        className={clsx(
                          "t-data px-3 py-2.5 text-right",
                          cost > 0 ? "text-text" : "text-text-faint",
                        )}
                      >
                        {formatUsd(call.cost_usd)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(paidForNothing.length > 0 || failures.length > 0) && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {paidForNothing.length > 0 && (
            <li className="flex items-start gap-2 text-[0.8125rem] leading-snug text-human">
              <CircleAlert aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
              <span>
                {paidForNothing.map((c) => c.provider).join(", ")} cost{" "}
                {formatUsd(
                  paidForNothing
                    .reduce((sum, c) => sum + Number.parseFloat(c.cost_usd), 0)
                    .toString(),
                )}{" "}
                and returned no usable evidence.
              </span>
            </li>
          )}
          {failures.length > 0 && (
            <li className="flex items-start gap-2 text-[0.8125rem] leading-snug text-reject">
              <CircleAlert aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
              <span>
                {failures.map((c) => c.provider).join(", ")} did not complete — ARIE decided without
                it.
              </span>
            </li>
          )}
        </ul>
      )}

      {/* ----------------------------------------------------- not called */}
      <div className="mt-5">
        <p className="text-xs font-medium text-text-dim">Providers not reached</p>
        {notCalled.length === 0 ? (
          <p className="mt-1.5 text-xs text-text-faint">All providers were called.</p>
        ) : (
          <>
            <p className="mt-2 flex flex-wrap gap-1.5">
              {notCalled.map((name) => (
                <span
                  key={name}
                  className="t-data rounded-md border border-border bg-bg-sunken px-2 py-0.5 text-text-faint"
                >
                  {name}
                </span>
              ))}
            </p>
            <p className="mt-2 text-[0.6875rem] text-text-faint">
              Not evaluated and rejected — simply not reached before ARIE stopped.
            </p>
          </>
        )}
      </div>

      {/* --------------------------------------------------- known fields */}
      {evidence.items.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-medium text-text-dim">
            Fields known at decision time ({evidence.items.length})
          </p>
          <ul className="mt-2 flex flex-col gap-2 sm:hidden">
            {evidence.items.map((item) => (
              <li
                key={`m-${item.field}`}
                className="rounded-md border border-border bg-bg-sunken p-3"
              >
                <p className="flex items-center justify-between gap-2">
                  <span className="t-data text-text">{item.field}</span>
                  {item.contested && <span className="text-xs text-human">Contested</span>}
                </p>
                <p className="t-data mt-1 text-text-dim">{item.source}</p>
                <p className="mt-2 flex items-center gap-2">
                  <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
                    <span
                      className="block h-full rounded-full bg-machine"
                      style={{ width: `${Math.round(item.confidence * 100)}%` }}
                    />
                  </span>
                  <span className="t-data shrink-0 text-text-dim">
                    {(item.confidence * 100).toFixed(0)}%
                  </span>
                </p>
              </li>
            ))}
          </ul>

          <div className="scroll-x mt-2 hidden rounded-md border border-border sm:block">
            <table className="w-full min-w-[30rem] border-collapse text-left">
              <caption className="sr-only">
                Each resolved field, the provider whose value won, and how confident that value was
              </caption>
              <thead>
                <tr className="border-b border-border bg-bg-sunken">
                  <Th>Field</Th>
                  <Th>Winning source</Th>
                  <Th>Field confidence</Th>
                  <Th align="right">Contested</Th>
                </tr>
              </thead>
              <tbody>
                {evidence.items.map((item) => (
                  <tr key={item.field} className="border-b border-border last:border-0">
                    <td className="t-data px-3 py-2.5 text-text">{item.field}</td>
                    <td className="t-data px-3 py-2.5 text-text-dim">{item.source}</td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-2">
                        <span className="h-1 w-20 shrink-0 overflow-hidden rounded-full bg-surface-3">
                          <span
                            className="block h-full rounded-full bg-machine"
                            style={{ width: `${Math.round(item.confidence * 100)}%` }}
                          />
                        </span>
                        <span className="t-data text-text-dim">
                          {(item.confidence * 100).toFixed(0)}%
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs">
                      {item.contested ? (
                        <span className="text-human">Contested</span>
                      ) : (
                        <span className="text-text-faint">—</span>
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
        <div className="mt-5">
          <p className="text-xs font-medium text-text-dim">
            Still unknown when the decision was made ({evidence.unknown_fields.length})
          </p>
          <p className="mt-2 flex flex-wrap gap-1.5">
            {evidence.unknown_fields.map((field) => (
              <span
                key={field}
                className="t-data rounded-md border border-dashed border-border-strong px-2 py-0.5 text-text-faint"
              >
                {field}
              </span>
            ))}
          </p>
          <p className="mt-2 text-[0.6875rem] text-text-faint">
            ARIE committed to a decision without these — that uncertainty is priced into the
            confidence figure above, not ignored.
          </p>
        </div>
      )}

      <p className="mt-5 border-t border-border pt-3 text-[0.6875rem] leading-relaxed text-text-faint">
        {evidence.provider_calls} fresh {callNoun(evidence.provider_calls !== 1)} ·{" "}
        {evidence.cache_hits} cache {evidence.cache_hits === 1 ? "reuse" : "reuses"}
      </p>
    </Panel>
  );
}

function LegendItem({
  icon: Icon,
  className,
  label,
}: {
  icon: typeof CircleCheck;
  className: string;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-text-dim">
      <Icon aria-hidden className={clsx("h-3.5 w-3.5", className)} strokeWidth={2.25} />
      {label}
    </span>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      scope="col"
      className={clsx(
        "t-label px-3 py-2 font-medium text-text-faint",
        align === "right" && "text-right",
      )}
    >
      {children}
    </th>
  );
}
