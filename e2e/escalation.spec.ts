import { expect, test } from "@playwright/test";

/**
 * Scenarios B and C from the P4 brief: the escalation identity (Nadia
 * Haddad) is recommended for rejection but refuses to act autonomously,
 * requiring a human review; approving through the UI must preserve the
 * machine recommendation, the human action, and the final outcome as three
 * distinct, visible facts -- never collapsed into "ARIE decided
 * AUTO_ROUTED". A page refresh afterward must reconstruct the same state
 * from the backend, not from in-memory UI state.
 */
test("escalation scenario: human review required, approve preserves the full sequence, refresh reconstructs it", async ({
  page,
}) => {
  await page.goto("/leads/new");
  await page.getByRole("button", { name: /Nadia Haddad/ }).click();
  await page.getByRole("button", { name: "Submit lead" }).click();

  await page.waitForURL(/\/leads\/[0-9a-f-]{36}$/, { timeout: 75_000 });
  const receiptUrl = page.url();

  // --- Scenario B: pending review, machine recommendation visible first ---
  await expect(page.getByText("Awaiting human review", { exact: true })).toBeVisible();
  await expect(page.getByText("Machine recommendation")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reject", exact: true })).toBeVisible();
  await expect(page.getByText("Autonomous", { exact: true })).toBeVisible();
  await expect(page.getByText("No", { exact: true })).toBeVisible();
  await expect(page.getByText("Human review required")).toBeVisible();

  // Approve through the UI (two-step confirm, no modal).
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page.getByRole("button", { name: "Submit decision" }).click();
  await page.getByRole("button", { name: "Confirm approve" }).click();

  // --- The sequence must show all three stages, not a collapsed summary ---
  // Submitting a decision costs three sequential round trips through the
  // proxy (POST decision, re-GET receipt, re-GET review). Against a hosted
  // backend each is ~2s, so the whole settle exceeds the 5s default -- the
  // wait below is about network latency, not about the UI being slow to
  // react.
  const SETTLE = 25_000;
  await expect(page.getByText("Human action —", { exact: false })).toBeVisible({
    timeout: SETTLE,
  });
  await expect(page.getByText("Approved", { exact: true })).toBeVisible();
  // "Final outcome" now labels both the verdict panel's eyebrow and the
  // chain's closing stage, so scope to the first rather than asserting a
  // single match.
  await expect(page.getByText("Final outcome").first()).toBeVisible();
  // Appears three times once resolved: the status pill, the verdict
  // headline, and the Final outcome stage -- all expected, not a bug.
  await expect(page.getByText("Auto-routed", { exact: true })).toHaveCount(3);
  await expect(page.getByText(/Human override/).first()).toBeVisible();
  // The original recommendation must still be visible, not erased.
  await expect(page.getByText("Reject", { exact: true }).first()).toBeVisible();

  // --- Scenario C: refresh must reconstruct this from the backend ---
  await page.reload();
  await expect(page).toHaveURL(receiptUrl);
  await expect(page.getByText("Approved", { exact: true })).toBeVisible({ timeout: SETTLE });
  await expect(page.getByText("Auto-routed", { exact: true })).toHaveCount(3);
  await expect(page.getByText(/Human override/).first()).toBeVisible();
  // The pending-review form must be gone -- this is now a resolved review.
  await expect(page.getByRole("button", { name: "Submit decision" })).toHaveCount(0);
});
