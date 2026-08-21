"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDataMode } from "@/lib/api/mode";
import { getLead } from "@/lib/api/leads";
import { getRecentLeads, type RecentLeadEntry } from "@/lib/localHistory";
import { formatDateTime, statusLabel } from "@/lib/format";
import { toneForStatus } from "@/lib/format/decision";
import type { LeadStatus } from "@/lib/api/types";
import { Panel, Eyebrow } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";

export default function DashboardPage() {
  const mode = getDataMode();
  const router = useRouter();
  const [recent, setRecent] = useState<RecentLeadEntry[]>([]);
  const [statuses, setStatuses] = useState<Record<string, LeadStatus>>({});
  const [lookupId, setLookupId] = useState("");

  useEffect(() => {
    // Reads localStorage, which doesn't exist during SSR -- must run
    // post-mount, not as lazy initial state (that would read on the
    // server-matching first client render too and desync from the SSR'd
    // empty list, not before it).
    const entries = getRecentLeads();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecent(entries);

    // Best-effort, per-card status badges -- a card simply shows no badge if
    // its fetch fails (deleted lead, momentary network blip), never an error
    // that would break the rest of the list.
    let cancelled = false;
    Promise.allSettled(entries.map((entry) => getLead(entry.lead_id))).then((results) => {
      if (cancelled) return;
      const next: Record<string, LeadStatus> = {};
      results.forEach((result, i) => {
        if (result.status === "fulfilled") next[entries[i].lead_id] = result.value.status;
      });
      setStatuses(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleLookup(event: React.FormEvent) {
    event.preventDefault();
    const id = lookupId.trim();
    if (id) router.push(`/leads/${id}`);
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-panel px-8 py-14 sm:px-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(var(--border-strong) 1px, transparent 1px), linear-gradient(90deg, var(--border-strong) 1px, transparent 1px)",
            backgroundSize: "36px 36px",
          }}
        />
        <div className="relative max-w-2xl">
          <Eyebrow>Adaptive Revenue Intelligence Engine</Eyebrow>
          <h1 className="mt-3 font-display text-4xl leading-[1.1] font-medium text-text sm:text-5xl">
            One lead. Every reason ARIE stopped where it did.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-text-dim">
            Submit a lead and watch it move through evidence, scoring, and a decision — a
            recommendation, a confidence check, and either an autonomous action or a human
            checkpoint. Nothing is collapsed: what the machine recommended and what actually
            happened stay visible side by side.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/leads/new"
              className="rounded-lg bg-machine px-5 py-3 text-sm font-semibold text-bg transition-transform hover:scale-[1.02] active:scale-[0.99]"
            >
              Submit a new lead
            </Link>
            {mode === "mock" && (
              <span className="font-data text-xs uppercase tracking-wider text-text-faint">
                Running in mock mode — no backend required
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="mt-12">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <div>
            <h2 className="font-display text-xl font-medium text-text">
              Recently submitted from this browser
            </h2>
            <p className="mt-0.5 font-data text-xs text-text-faint">
              Local history only, kept in this browser — not a claim about server-side state. ARIE
              exposes no endpoint to list leads globally.
            </p>
          </div>
          <form onSubmit={handleLookup} className="flex items-center gap-2">
            <input
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
              placeholder="Look up a lead by ID…"
              className="input w-56 font-data text-xs"
              aria-label="Look up a lead by ID"
            />
            <button
              type="submit"
              disabled={!lookupId.trim()}
              className="rounded-lg border border-border-strong px-3 py-[0.55rem] text-xs font-medium text-text-dim transition-colors hover:border-machine hover:text-machine disabled:opacity-40 disabled:hover:border-border-strong disabled:hover:text-text-dim"
            >
              View
            </button>
          </form>
        </div>

        {recent.length === 0 ? (
          <Panel className="text-text-dim">
            <p>
              Nothing submitted yet from this browser.{" "}
              <Link href="/leads/new" className="text-machine underline underline-offset-4">
                Submit your first lead
              </Link>{" "}
              to see the full decision sequence, or look up a lead by ID above if you already have
              one.
            </p>
          </Panel>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {recent.map((entry) => {
              const status = statuses[entry.lead_id];
              return (
                <li key={entry.lead_id}>
                  <Link
                    href={`/leads/${entry.lead_id}`}
                    className="block rounded-xl border border-border bg-panel p-5 transition-colors hover:border-border-strong hover:bg-panel-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-text">{entry.label}</p>
                      <div className="flex items-center gap-1.5">
                        {entry.is_shadow && <Badge tone="shadow">Shadow</Badge>}
                        {status && (
                          <Badge tone={toneForStatus(status)}>{statusLabel(status)}</Badge>
                        )}
                      </div>
                    </div>
                    <p className="mt-1 font-data text-xs text-text-faint">{entry.email}</p>
                    <p className="mt-3 font-data text-[0.7rem] uppercase tracking-wider text-text-faint">
                      Submitted {formatDateTime(entry.submitted_at)}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
