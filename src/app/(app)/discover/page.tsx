"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Search } from "lucide-react";
import { getActiveICPProfile } from "@/lib/api/icp";
import { startDiscoveryRun } from "@/lib/api/discovery";
import type { CustomerPriority, DiscoveryRunWithOpportunities, ICPProfile } from "@/lib/api/types";
import { priorityLabel } from "@/lib/format/recommendation";
import { Panel, PanelHeader, Eyebrow } from "@/components/ui/Panel";
import { Button, ButtonLink } from "@/components/ui/Button";
import { DiscoveryProgress } from "@/components/discover/DiscoveryProgress";
import { FunnelSummary } from "@/components/discover/FunnelSummary";
import { OpportunityCard } from "@/components/discover/OpportunityCard";

const PRIORITY_ORDER: CustomerPriority[] = ["contact_first", "worth_pursuing", "review", "skip"];
const DEFAULT_COUNT = 20;

/**
 * The primary product surface the Discovery Pivot exists to build: "tell me
 * what you sell and I will find the opportunities worth your attention."
 * Input comes from the customer's already-confirmed targeting profile — see
 * `PanelHeader`'s summary below — never re-asked here.
 */
export default function DiscoverPage() {
  const [profile, setProfile] = useState<ICPProfile | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [market, setMarket] = useState("");
  const [count, setCount] = useState(DEFAULT_COUNT);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiscoveryRunWithOpportunities | null>(null);

  useEffect(() => {
    let cancelled = false;
    getActiveICPProfile()
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {
        if (!cancelled) setProfileError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setRunning(true);
    setError(null);
    try {
      const run = await startDiscoveryRun({
        requested_opportunity_count: count,
        market: market.trim() || null,
      });
      setResult(run);
    } catch {
      setError("ARIE couldn't finish this discovery run. Try again in a moment.");
    } finally {
      setRunning(false);
    }
  }

  const grouped = result
    ? PRIORITY_ORDER.map((priority) => ({
        priority,
        items: result.opportunities.filter((o) => o.priority === priority),
      })).filter((group) => group.items.length > 0)
    : [];

  return (
    <div className="mx-auto max-w-[900px] px-5 py-10 sm:px-8 sm:py-14">
      <header className="max-w-2xl">
        <Eyebrow>Find customers</Eyebrow>
        <h1 className="t-h1 mt-1.5 text-balance text-text">
          Find the opportunities worth your attention
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-text-dim">
          ARIE searches the market for companies matching your targeting profile, screens them
          cheaply, and only spends real research on the handful worth it — then tells you who to
          contact and why.
        </p>
      </header>

      <Panel className="mt-8" padding="lg">
        <PanelHeader
          eyebrow="What you sell, who you want"
          title={
            profileError
              ? "No targeting profile yet"
              : (profile?.name ?? "Loading your targeting profile…")
          }
          trailing={
            <ButtonLink href="/targeting" variant="ghost" size="sm">
              {profile ? "Edit targeting" : "Set up targeting"}
            </ButtonLink>
          }
        />
        {profileError && (
          <p className="mt-3 text-sm text-text-dim">
            Set up your targeting profile first, then come back here.{" "}
            <Link href="/targeting" className="text-text underline underline-offset-2">
              Set it up now
            </Link>
            .
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto]">
          <div>
            <label htmlFor="discover-market" className="t-label text-text-faint">
              Market (optional)
            </label>
            <input
              id="discover-market"
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              placeholder="e.g. Australia"
              className="input mt-1.5 w-full"
              disabled={running}
            />
          </div>
          <div>
            <label htmlFor="discover-count" className="t-label text-text-faint">
              How many?
            </label>
            <input
              id="discover-count"
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(Number(e.target.value) || DEFAULT_COUNT)}
              className="input mt-1.5 w-24"
              disabled={running}
            />
          </div>
          <div className="sm:col-span-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={running || !profile}
              className="w-full sm:w-auto"
            >
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
              ) : (
                <Search className="h-4 w-4" strokeWidth={2.25} />
              )}
              Find opportunities
            </Button>
          </div>
        </form>
        {error && <p className="mt-3 text-sm text-reject">{error}</p>}
      </Panel>

      {running && <DiscoveryProgress />}

      {result && !running && (
        <section className="mt-10">
          <FunnelSummary funnel={result.run.funnel} />

          {result.opportunities.length === 0 ? (
            <Panel className="mt-8" padding="lg">
              <Eyebrow>No opportunities this time</Eyebrow>
              <p className="mt-2 text-sm text-text-dim">
                ARIE didn&apos;t find a company worth promoting from this search. Try a broader
                market, or revisit your targeting profile — very narrow targeting can mean nothing
                clears the bar.
              </p>
            </Panel>
          ) : (
            <div className="mt-8 flex flex-col gap-8">
              {grouped.map((group) => (
                <div key={group.priority}>
                  <h2 className="t-h3 text-text">
                    {priorityLabel(group.priority)}{" "}
                    <span className="text-text-faint">({group.items.length})</span>
                  </h2>
                  <ul className="mt-3 flex flex-col gap-3">
                    {group.items.map((opportunity) => (
                      <OpportunityCard key={opportunity.candidate_id} opportunity={opportunity} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
