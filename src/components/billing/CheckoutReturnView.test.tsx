import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CheckoutReturnView } from "./CheckoutReturnView";

describe("CheckoutReturnView", () => {
  it("does not claim the subscription is active", () => {
    // The single most important property of this page. Stripe's success_url
    // only means "the browser came back" — a user can reach it by editing the
    // address bar, and the authoritative activation arrives separately via
    // the webhook, possibly a moment later. Saying "you're on Growth" here
    // would be a claim this page cannot support.
    render(<CheckoutReturnView status="success" />);

    expect(screen.getByText(/checkout complete/i)).toBeInTheDocument();
    expect(screen.getByText(/being activated/i)).toBeInTheDocument();
    expect(screen.queryByText(/subscription is active/i)).not.toBeInTheDocument();
  });

  it("states plainly that nothing changed on cancel", () => {
    render(<CheckoutReturnView status="canceled" />);

    expect(screen.getByText(/checkout canceled/i)).toBeInTheDocument();
    expect(screen.getByText(/no changes were made/i)).toBeInTheDocument();
  });

  it("treats a missing or unrecognized status as not-succeeded", () => {
    // `?status=` is caller-controlled — it comes back through the browser.
    // Anything that isn't exactly "success" must land on the safe branch, so
    // a hand-edited URL cannot manufacture a success screen.
    render(<CheckoutReturnView status={null} />);

    expect(screen.getByText(/checkout canceled/i)).toBeInTheDocument();
    expect(screen.queryByText(/checkout complete/i)).not.toBeInTheDocument();
  });

  it("sends the user back to the page that shows the real state", () => {
    // Settings' BillingPanel reads /billing fresh, so it shows whatever the
    // backend actually has — which is the honest answer this page defers to.
    render(<CheckoutReturnView status="success" />);

    expect(screen.getByRole("link", { name: /billing settings/i })).toHaveAttribute(
      "href",
      "/settings",
    );
  });
});
