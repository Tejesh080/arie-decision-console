import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BillingPanel } from "./BillingPanel";
import { ArieApiError, ArieEntitlementError } from "@/lib/api/errors";
import type {
  BillingResponse,
  BillingStatus,
  EffectiveEntitlementsResponse,
  OrganizationBillingResponse,
} from "@/lib/api/types";

const { getBillingMock, startCheckoutMock, openBillingPortalMock } = vi.hoisted(() => ({
  getBillingMock: vi.fn(),
  startCheckoutMock: vi.fn(),
  openBillingPortalMock: vi.fn(),
}));
vi.mock("@/lib/api/billing", () => ({
  getBilling: getBillingMock,
  startCheckout: startCheckoutMock,
  openBillingPortal: openBillingPortalMock,
}));

/** `handleSubscribe`/`handleManageBilling` hand the browser to Stripe with
 * `window.location.assign`. jsdom's real implementation would try to navigate
 * (and warn), so it is replaced with a spy — which is also the assertion
 * these tests actually care about: *where* the user gets sent. */
const assignMock = vi.fn();

function record(overrides: Partial<OrganizationBillingResponse> = {}): OrganizationBillingResponse {
  return {
    organization_id: "org-1",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    plan: "starter",
    status: "none",
    current_period_start: null,
    current_period_end: null,
    cancel_at_period_end: false,
    canceled_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function entitlements(
  overrides: Partial<EffectiveEntitlementsResponse> = {},
): EffectiveEntitlementsResponse {
  return {
    plan: "unsubscribed",
    max_leads_per_month: 25,
    max_csv_rows_per_upload: 10,
    max_modeled_spend_usd_per_month: 1,
    max_members: 1,
    live_provider_feature_allowed: false,
    ...overrides,
  };
}

function billing(
  recordOverrides: Partial<OrganizationBillingResponse> = {},
  entitlementOverrides: Partial<EffectiveEntitlementsResponse> = {},
): BillingResponse {
  return {
    billing: record(recordOverrides),
    entitlements: entitlements(entitlementOverrides),
  };
}

const SUBSCRIBED_GROWTH = billing(
  {
    plan: "growth",
    status: "active",
    stripe_customer_id: "cus_test",
    stripe_subscription_id: "sub_test",
    current_period_start: "2026-01-01T00:00:00Z",
    current_period_end: "2026-02-01T00:00:00Z",
  },
  {
    plan: "growth",
    max_leads_per_month: 5000,
    max_csv_rows_per_upload: 200,
    max_modeled_spend_usd_per_month: 50,
    max_members: 10,
    live_provider_feature_allowed: true,
  },
);

describe("BillingPanel", () => {
  beforeEach(() => {
    getBillingMock.mockReset();
    startCheckoutMock.mockReset();
    openBillingPortalMock.mockReset();
    assignMock.mockReset();
    vi.stubGlobal("location", {
      origin: "https://console.example",
      assign: assignMock,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the effective plan, not the stored one, when a subscription lapses", async () => {
    // The distinction the whole entitlement model rests on: the row still
    // says `growth` (that is what the customer bought), but nothing is
    // currently active, so what they can actually do is the unsubscribed
    // floor. Showing the stored plan here would tell someone they have
    // 5,000 leads a month while the API refuses at 25.
    getBillingMock.mockResolvedValue(billing({ plan: "growth", status: "past_due" }));

    render(<BillingPanel canEdit={true} />);

    await waitFor(() => expect(screen.getByText("No active plan")).toBeInTheDocument());
    expect(screen.getByText("25")).toBeInTheDocument();
  });

  it("warns about a payment problem without locking the page", async () => {
    getBillingMock.mockResolvedValue(billing({ plan: "growth", status: "past_due" }));

    render(<BillingPanel canEdit={true} />);

    await waitFor(() =>
      expect(
        screen.getByText(/problem with this organization's subscription payment/i),
      ).toBeInTheDocument(),
    );
    // Still offers a way out — an owner in payment trouble must never be
    // locked away from the screen that fixes it.
    expect(screen.getByRole("button", { name: /growth/i })).toBeInTheDocument();
  });

  it("says a subscription will end when cancel-at-period-end is set", async () => {
    getBillingMock.mockResolvedValue(
      billing(
        {
          plan: "growth",
          status: "active",
          cancel_at_period_end: true,
          current_period_end: "2026-02-01T00:00:00Z",
          stripe_customer_id: "cus_test",
        },
        { plan: "growth" },
      ),
    );

    render(<BillingPanel canEdit={true} />);

    await waitFor(() => expect(screen.getByText(/will end on/i)).toBeInTheDocument());
    expect(screen.getByText(/not renew/i)).toBeInTheDocument();
  });

  it("sends the browser to Stripe's checkout url with return urls on this origin", async () => {
    getBillingMock.mockResolvedValue(billing());
    startCheckoutMock.mockResolvedValue({ checkout_url: "https://checkout.stripe.com/c/test" });
    render(<BillingPanel canEdit={true} />);
    await waitFor(() => expect(screen.getByText("No active plan")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Growth" }));

    await waitFor(() => expect(startCheckoutMock).toHaveBeenCalledOnce());
    expect(startCheckoutMock).toHaveBeenCalledWith({
      plan: "growth",
      success_url: "https://console.example/checkout-return?status=success",
      cancel_url: "https://console.example/checkout-return?status=canceled",
    });
    expect(assignMock).toHaveBeenCalledWith("https://checkout.stripe.com/c/test");
  });

  it("never sends a Stripe price id — only an ARIE plan name", async () => {
    // The backend translates plan -> price id (StripeConfig.price_id_for_plan)
    // precisely so a caller cannot name an arbitrary price. If this component
    // ever started sending one, that protection would be pointless.
    getBillingMock.mockResolvedValue(billing());
    startCheckoutMock.mockResolvedValue({ checkout_url: "https://checkout.stripe.com/c/test" });
    render(<BillingPanel canEdit={true} />);
    await waitFor(() => expect(screen.getByText("No active plan")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Starter" }));

    await waitFor(() => expect(startCheckoutMock).toHaveBeenCalledOnce());
    const sent = JSON.stringify(startCheckoutMock.mock.calls[0][0]);
    expect(sent).not.toMatch(/price_/);
  });

  it("surfaces a checkout failure and re-enables the buttons", async () => {
    getBillingMock.mockResolvedValue(billing());
    startCheckoutMock.mockRejectedValue(
      new ArieApiError("Stripe is not configured on this deployment.", 503),
    );
    render(<BillingPanel canEdit={true} />);
    await waitFor(() => expect(screen.getByText("No active plan")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Growth" }));

    await waitFor(() =>
      expect(screen.getByText("Stripe is not configured on this deployment.")).toBeInTheDocument(),
    );
    expect(assignMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Growth" })).toBeEnabled();
  });

  it("opens the Customer Portal once a Stripe customer exists", async () => {
    getBillingMock.mockResolvedValue(SUBSCRIBED_GROWTH);
    openBillingPortalMock.mockResolvedValue({ portal_url: "https://billing.stripe.com/p/test" });
    render(<BillingPanel canEdit={true} />);
    await waitFor(() => expect(screen.getByText("Growth")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /manage billing/i }));

    await waitFor(() =>
      expect(assignMock).toHaveBeenCalledWith("https://billing.stripe.com/p/test"),
    );
    expect(openBillingPortalMock).toHaveBeenCalledWith({
      return_url: "https://console.example/settings",
    });
  });

  it("hides the Customer Portal when there is no Stripe customer to manage", async () => {
    // Opening a Portal for a customer that doesn't exist is a guaranteed 4xx.
    getBillingMock.mockResolvedValue(billing());

    render(<BillingPanel canEdit={true} />);

    await waitFor(() => expect(screen.getByText("No active plan")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /manage billing/i })).not.toBeInTheDocument();
  });

  it("hides every commercial action for the grandfathered internal plan", async () => {
    // The Legacy Organization has no Stripe relationship and never will.
    // Offering it Checkout would move the deployment's own tenant onto a paid
    // plan with *lower* limits than the internal tier it already has.
    getBillingMock.mockResolvedValue(
      billing({ plan: "internal", status: "active" }, { plan: "internal", max_members: 25 }),
    );

    render(<BillingPanel canEdit={true} />);

    await waitFor(() => expect(screen.getByText("Internal")).toBeInTheDocument());
    expect(screen.getByText("Grandfathered")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Growth" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /manage billing/i })).not.toBeInTheDocument();
  });

  it("shows plan facts but no actions to a non-admin", async () => {
    getBillingMock.mockResolvedValue(SUBSCRIBED_GROWTH);

    render(<BillingPanel canEdit={false} />);

    await waitFor(() => expect(screen.getByText("Growth")).toBeInTheDocument());
    expect(screen.getByText("5000")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /manage billing/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pro" })).not.toBeInTheDocument();
  });

  it("states whether the plan includes live provider configuration", async () => {
    getBillingMock.mockResolvedValue(billing());
    const { unmount } = render(<BillingPanel canEdit={true} />);
    await waitFor(() =>
      expect(screen.getByText(/requires an active subscription/i)).toBeInTheDocument(),
    );
    unmount();

    getBillingMock.mockResolvedValue(SUBSCRIBED_GROWTH);
    render(<BillingPanel canEdit={true} />);
    await waitFor(() =>
      expect(
        screen.getByText(/includes live provider \(BYOK\) configuration/i),
      ).toBeInTheDocument(),
    );
  });

  it("reports a load failure instead of rendering an empty panel", async () => {
    getBillingMock.mockRejectedValue(new ArieApiError("Backend unreachable.", 502));

    render(<BillingPanel canEdit={true} />);

    await waitFor(() => expect(screen.getByText("Backend unreachable.")).toBeInTheDocument());
  });

  it("surfaces a 402 entitlement refusal in the panel's own words", async () => {
    getBillingMock.mockResolvedValue(billing());
    startCheckoutMock.mockRejectedValue(
      new ArieEntitlementError("This plan does not permit another member."),
    );
    render(<BillingPanel canEdit={true} />);
    await waitFor(() => expect(screen.getByText("No active plan")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Pro" }));

    await waitFor(() =>
      expect(screen.getByText("This plan does not permit another member.")).toBeInTheDocument(),
    );
  });

  it.each<[BillingStatus, string]>([
    ["active", "active"],
    ["trialing", "trialing"],
    ["past_due", "past due"],
    ["canceled", "canceled"],
  ])("renders the %s status badge readably", async (status, label) => {
    getBillingMock.mockResolvedValue(
      billing({ plan: "growth", status, stripe_customer_id: "cus_test" }),
    );

    render(<BillingPanel canEdit={true} />);

    await waitFor(() => expect(screen.getByText(label)).toBeInTheDocument());
  });
});
