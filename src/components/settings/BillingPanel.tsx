"use client";

import { useEffect, useState } from "react";
import { CircleAlert, ExternalLink } from "lucide-react";
import { getBilling, openBillingPortal, startCheckout } from "@/lib/api/billing";
import { ArieApiError } from "@/lib/api/errors";
import type { BillingResponse, PurchasablePlan } from "@/lib/api/types";
import { PURCHASABLE_PLANS } from "@/lib/api/types";
import { formatDateTime, formatUsd } from "@/lib/format";
import { Panel, Eyebrow, PanelHeader } from "@/components/ui/Panel";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StatRow, Stat } from "@/components/ui/Stat";

const PLAN_LABEL: Record<string, string> = {
  internal: "Internal",
  unsubscribed: "No active plan",
  starter: "Starter",
  growth: "Growth",
  pro: "Pro",
};

const STATUS_TONE: Record<string, BadgeTone> = {
  active: "qualify",
  trialing: "qualify",
  none: "neutral",
  past_due: "human",
  canceled: "reject",
  unpaid: "reject",
  incomplete: "human",
  incomplete_expired: "reject",
  paused: "human",
};

function returnUrl(status: "success" | "canceled"): string {
  return `${window.location.origin}/checkout-return?status=${status}`;
}

/** Productization M6 Parts 17-19. `canEdit` mirrors every other settings
 * panel's owner/admin gate — the backend independently re-derives it
 * (`_require_org_admin`), this is a UI courtesy only. */
export function BillingPanel({ canEdit }: { canEdit: boolean }) {
  const [billing, setBilling] = useState<BillingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  function load() {
    setLoading(true);
    getBilling()
      .then((result) => setBilling(result))
      .catch((err) => setLoadError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function handleSubscribe(plan: PurchasablePlan) {
    setActionError(null);
    setPendingAction(`checkout:${plan}`);
    try {
      const { checkout_url } = await startCheckout({
        plan,
        success_url: returnUrl("success"),
        cancel_url: returnUrl("canceled"),
      });
      window.location.assign(checkout_url);
    } catch (err) {
      setActionError(err instanceof ArieApiError ? err.message : String(err));
      setPendingAction(null);
    }
  }

  async function handleManageBilling() {
    setActionError(null);
    setPendingAction("portal");
    try {
      const { portal_url } = await openBillingPortal({
        return_url: `${window.location.origin}/settings`,
      });
      window.location.assign(portal_url);
    } catch (err) {
      setActionError(err instanceof ArieApiError ? err.message : String(err));
      setPendingAction(null);
    }
  }

  if (loading) {
    return (
      <Panel padding="lg" className="mt-6">
        <p className="text-sm text-text-faint">Loading billing…</p>
      </Panel>
    );
  }

  if (loadError || !billing) {
    return (
      <Panel padding="lg" accent="reject" className="mt-6">
        <p className="flex items-center gap-2 text-sm text-text">
          <CircleAlert aria-hidden className="h-4 w-4 shrink-0 text-reject" strokeWidth={2.25} />
          {loadError ?? "Could not load billing."}
        </p>
      </Panel>
    );
  }

  const { billing: record, entitlements } = billing;
  const isInternal = record.plan === "internal";
  const needsAttention = ["past_due", "unpaid", "incomplete_expired"].includes(record.status);

  return (
    <Panel padding="lg" accent="machine" className="mt-6">
      <PanelHeader
        eyebrow="Billing"
        title={
          <span className="flex items-center gap-2">
            {PLAN_LABEL[entitlements.plan] ?? entitlements.plan}
            <Badge tone={STATUS_TONE[record.status] ?? "neutral"} size="sm">
              {isInternal ? "Grandfathered" : record.status.replace(/_/g, " ")}
            </Badge>
          </span>
        }
        trailing={
          canEdit && !isInternal && record.stripe_customer_id ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleManageBilling}
              disabled={pendingAction !== null}
            >
              {pendingAction === "portal" ? "Opening…" : "Manage billing"}
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.25} />
            </Button>
          ) : undefined
        }
      />

      {needsAttention && (
        <p className="mt-4 flex items-start gap-2 rounded-md border border-reject-edge bg-reject-dim px-3 py-2 text-sm text-text">
          <CircleAlert
            aria-hidden
            className="mt-0.5 h-4 w-4 shrink-0 text-reject"
            strokeWidth={2.25}
          />
          There&apos;s a problem with this organization&apos;s subscription payment. Some features
          are limited until it&apos;s resolved.
        </p>
      )}

      {record.cancel_at_period_end && record.current_period_end && (
        <p className="mt-4 flex items-start gap-2 rounded-md border border-human-edge bg-human-dim px-3 py-2 text-sm text-text">
          <CircleAlert
            aria-hidden
            className="mt-0.5 h-4 w-4 shrink-0 text-human"
            strokeWidth={2.25}
          />
          This subscription will end on {formatDateTime(record.current_period_end)} and not renew.
        </p>
      )}

      {record.current_period_start && record.current_period_end && (
        <p className="mt-4 text-xs text-text-faint">
          Current period: {formatDateTime(record.current_period_start)} –{" "}
          {formatDateTime(record.current_period_end)}
        </p>
      )}

      <div className="mt-5">
        <StatRow>
          <Stat label="Leads / month" value={entitlements.max_leads_per_month} />
          <Stat label="Max CSV rows / upload" value={entitlements.max_csv_rows_per_upload} />
          <Stat
            label="Modeled spend / month"
            value={formatUsd(entitlements.max_modeled_spend_usd_per_month, 2)}
          />
          <Stat label="Team members" value={entitlements.max_members} />
        </StatRow>
      </div>

      <p className="mt-4 text-xs text-text-faint">
        {entitlements.live_provider_feature_allowed
          ? "This plan includes live provider (BYOK) configuration."
          : "Live provider (BYOK) configuration requires an active subscription."}
      </p>

      {actionError && (
        <p className="mt-4 flex items-center gap-2 rounded-md border border-reject-edge bg-reject-dim px-3 py-2 text-sm text-text">
          <CircleAlert aria-hidden className="h-4 w-4 shrink-0 text-reject" strokeWidth={2.25} />
          {actionError}
        </p>
      )}

      {canEdit && !isInternal && (
        <div className="mt-6 border-t border-border pt-5">
          <Eyebrow>
            {record.status === "active" || record.status === "trialing"
              ? "Change plan"
              : "Choose a plan"}
          </Eyebrow>
          <div className="mt-3 flex flex-wrap gap-3">
            {PURCHASABLE_PLANS.map((plan) => (
              <Button
                key={plan}
                variant={plan === record.plan ? "primary" : "secondary"}
                size="sm"
                disabled={
                  pendingAction !== null || (plan === record.plan && entitlements.plan === plan)
                }
                onClick={() => handleSubscribe(plan)}
              >
                {pendingAction === `checkout:${plan}`
                  ? "Redirecting…"
                  : plan === record.plan && entitlements.plan === plan
                    ? `Current: ${PLAN_LABEL[plan]}`
                    : PLAN_LABEL[plan]}
              </Button>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
