import { expect, test } from "@playwright/test";

/**
 * Scenario D from the P4 brief. Only meaningful with the dev server running
 * in "api" mode against a backend that is NOT running -- run manually via:
 *
 *   NEXT_PUBLIC_ARIE_DATA_MODE=api NEXT_PUBLIC_ARIE_API_BASE_URL=http://localhost:8000 npm run dev
 *   (without starting the ARIE backend)
 *   npx playwright test e2e/backend-unavailable.spec.ts
 *
 * In mock mode this scenario cannot occur (there is no backend to be
 * unavailable), so this spec is skipped there rather than asserting
 * something meaningless.
 */
test("backend unavailable renders a clear, non-blank error state", async ({ page }) => {
  test.skip(
    process.env.NEXT_PUBLIC_ARIE_DATA_MODE !== "api",
    "Only meaningful in api mode with the backend deliberately stopped.",
  );

  await page.goto("/leads/new");
  await page.getByRole("button", { name: "Nadia Delacroix — autonomous" }).click();
  await page.getByRole("button", { name: "Submit lead" }).click();

  // Matches in more than one place on purpose (header connection badge +
  // the page's own error panel) -- .first() just confirms at least one is
  // showing; both being present is a feature, not ambiguity to resolve.
  await expect(
    page.getByText(/ARIE backend unavailable|Could not reach the ARIE backend/).first(),
  ).toBeVisible({ timeout: 15_000 });

  // The page must still be usable -- not blank, not a raw stack trace.
  await expect(page.getByRole("heading", { name: "Submit a lead to ARIE" })).toBeVisible();
});

test("a receipt page for an unreachable backend also shows a clear error, not a blank page", async ({
  page,
}) => {
  test.skip(
    process.env.NEXT_PUBLIC_ARIE_DATA_MODE !== "api",
    "Only meaningful in api mode with the backend deliberately stopped.",
  );

  await page.goto("/leads/00000000-0000-0000-0000-000000000000");
  // Matches in more than one place on purpose (header connection badge +
  // the page's own error panel) -- .first() just confirms at least one is
  // showing; both being present is a feature, not ambiguity to resolve.
  await expect(
    page.getByText(/ARIE backend unavailable|Could not reach the ARIE backend/).first(),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
});
