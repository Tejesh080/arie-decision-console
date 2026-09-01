"use client";

import { CircleCheck, CircleX } from "lucide-react";
import { Wordmark } from "@/components/brand/Mark";
import { Panel, Eyebrow } from "@/components/ui/Panel";
import { ButtonLink } from "@/components/ui/Button";

/**
 * Productization M6 Part 17 — where Stripe Checkout's `success_url`/
 * `cancel_url` land (`BillingPanel.handleSubscribe`). Entitlements are not
 * necessarily live yet the instant this page renders: the authoritative
 * update comes from the `checkout.session.completed`/`customer.subscription
 * .created` webhook, which can arrive slightly after the browser redirect.
 * This page deliberately doesn't poll or claim success itself — it points
 * back to Settings, whose `BillingPanel` shows whatever the backend
 * currently has, honestly.
 */
export function CheckoutReturnView({ status }: { status: "success" | "canceled" | null }) {
  const succeeded = status === "success";

  return (
    <main id="content" className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Wordmark />
        </div>

        <Panel padding="lg" className="text-center">
          <Eyebrow>Billing</Eyebrow>

          {succeeded ? (
            <>
              <div className="mt-3 flex items-center justify-center gap-2 text-qualify">
                <CircleCheck className="h-5 w-5 shrink-0" strokeWidth={2.25} />
                <p className="text-sm font-medium">Checkout complete</p>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-text-dim">
                Your subscription is being activated. It usually reflects on this account within a
                few seconds.
              </p>
            </>
          ) : (
            <>
              <div className="mt-3 flex items-center justify-center gap-2 text-text-dim">
                <CircleX className="h-5 w-5 shrink-0" strokeWidth={2.25} />
                <p className="text-sm font-medium">Checkout canceled</p>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-text-dim">
                No changes were made to your subscription.
              </p>
            </>
          )}

          <ButtonLink href="/settings" variant="primary" className="mt-6 w-full">
            Go to billing settings
          </ButtonLink>
        </Panel>
      </div>
    </main>
  );
}
