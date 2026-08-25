import { expect, test } from "@playwright/test";

/**
 * Scenario A from the P4 brief: submit the deterministic autonomous
 * identity (Nadia Delacroix) and verify she reaches AUTO_ROUTED with no
 * human review surface at all. Runs unchanged against both mock mode and
 * a real local ARIE backend -- the UI contract is identical either way.
 */
test("autonomous scenario: Nadia Delacroix reaches an autonomous decision", async ({ page }) => {
  await page.goto("/leads/new");
  await page.getByRole("button", { name: /Nadia Delacroix/ }).click();
  await page.getByRole("button", { name: "Submit lead" }).click();

  await page.waitForURL(/\/leads\/[0-9a-f-]{36}$/, { timeout: 30_000 });

  // "Auto-routed" now appears twice on purpose: the status pill, and the
  // verdict prose naming the final status. Both are expected.
  await expect(page.getByText("Auto-routed", { exact: true }).first()).toBeVisible();
  // A genuinely autonomous decision is framed as one -- there is no human
  // stage in the chain to contrast it against, so the verdict panel names
  // the decision directly.
  await expect(page.getByText("Autonomous decision", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Auto-route", exact: true })).toBeVisible();
  await expect(page.getByText(/ARIE acted without a human/)).toBeVisible();

  // No human review surface at all for a genuinely autonomous decision.
  // (exact: true -- Playwright's default text match is a case-insensitive
  // substring, which would otherwise match inside "no human review
  // required" below.)
  await expect(page.getByText("Human review required", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Submit decision" })).toHaveCount(0);

  // The receipt renders real evidence and score data, not a placeholder.
  await expect(page.getByRole("heading", { name: "Where the score landed" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Provider ledger" })).toBeVisible();
  await expect(page.getByText(/Fresh calls \(\d+\)/)).toBeVisible();
  // Provider outcome is load-bearing: a call that returned nothing must not
  // render identically to one that returned usable evidence.
  // The ledger renders twice -- a table for `sm` and up, stacked cards below
  // it -- with CSS picking one. At this viewport the table is the visible
  // variant, so scope to it rather than to whichever matches first in the DOM.
  await expect(page.locator("table").getByText("Returned data").first()).toBeVisible();
});
