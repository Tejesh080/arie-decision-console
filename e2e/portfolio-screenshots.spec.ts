import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * Screenshots of Ask ARIE and Find Customers for the portfolio README —
 * both reachable with zero setup in mock data mode (`NEXT_PUBLIC_ARIE_DATA_
 * MODE=mock`), which fabricates deterministic results client-side with no
 * real backend and no auth gate (see `middleware.ts`'s mock-mode no-op).
 * Independent of `screenshots.spec.ts` and `demo-screenshots.spec.ts` for
 * the same reason those two are independent of each other: no shared
 * `beforeAll`, so a failure or slow run in one file never blocks another.
 */

mkdirSync("screenshots", { recursive: true });

async function shoot(page: Page, name: string) {
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage: true });
}

test("capture Ask ARIE with an answer, at 1440px", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });

  // A fresh session has no leads yet, and "no leads matched" is an honest
  // but uninteresting screenshot -- run one example through first so there
  // is a real recommendation for Ask ARIE to find.
  await page.goto("/leads/new?run=autonomous");
  await expect(page.getByRole("heading", { name: "Nadia Delacroix" })).toBeVisible({
    timeout: 25_000,
  });
  await expect(page.getByText("Auto-routed").first()).toBeVisible({ timeout: 25_000 });
  // The mock store settles this lead's status asynchronously; give it a
  // clear margin past the receipt's own "decided" render before querying it
  // from a fresh page load, so Ask ARIE doesn't race a still-mid-flight
  // internal record.
  await page.waitForTimeout(6_000);

  await page.goto("/ask");
  await expect(page.getByRole("heading", { name: "What should I work on?" })).toBeVisible();
  await page.getByRole("button", { name: "Show my best leads" }).click();
  await expect(page.getByText(/Found \d+ matching lead/)).toBeVisible({ timeout: 15_000 });
  await shoot(page, "ask-arie");
});

test("capture Find Customers with results, at 1440px", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto("/discover");
  await expect(page.getByText("Who has a reason")).toBeVisible();
  await page.getByRole("button", { name: "Start investigating" }).click();
  await expect(page.getByText(/\d+ opportunities?$/)).toBeVisible({ timeout: 20_000 });
  await shoot(page, "find-customers");
});
