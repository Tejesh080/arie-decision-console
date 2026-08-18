import { expect, test } from "@playwright/test";

/**
 * Scenario A from the P4 brief: submit the deterministic autonomous
 * identity (Nadia Delacroix) and verify she reaches AUTO_ROUTED with no
 * human review surface at all. Runs unchanged against both mock mode and
 * a real local ARIE backend -- the UI contract is identical either way.
 */
test("autonomous scenario: Nadia Delacroix reaches an autonomous decision", async ({ page }) => {
  await page.goto("/leads/new");
  await page.getByRole("button", { name: "Nadia Delacroix — autonomous" }).click();
  await page.getByRole("button", { name: "Submit lead" }).click();

  await page.waitForURL(/\/leads\/[0-9a-f-]{36}$/, { timeout: 30_000 });

  await expect(page.getByText("Auto-routed", { exact: true })).toBeVisible();
  await expect(page.getByText("Machine recommendation")).toBeVisible();
  await expect(page.getByText("Auto-route", { exact: true })).toBeVisible();
  await expect(page.getByText("Acted autonomously")).toBeVisible();

  // No human review surface at all for a genuinely autonomous decision.
  // (exact: true -- Playwright's default text match is a case-insensitive
  // substring, which would otherwise match inside "no human review
  // required" below.)
  await expect(page.getByText("Human review required", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Submit decision" })).toHaveCount(0);

  // The receipt renders real evidence and score data, not a placeholder.
  await expect(page.getByText("Score & confidence")).toBeVisible();
  await expect(page.getByText("Fresh calls")).toBeVisible();
});
