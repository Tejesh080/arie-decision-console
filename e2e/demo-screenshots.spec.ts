import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * Screenshots of the permanently public `/demo` route
 * (`src/app/demo/page.tsx`) — the portfolio README's images. A deliberately
 * separate, independent spec from `screenshots.spec.ts`: that file's
 * top-level `beforeAll` submits real leads through the app's proxy and
 * requires a working backend/session, which `/demo` was built specifically
 * to need none of. Keeping this in its own file means these captures never
 * depend on that fixture setup succeeding.
 */

mkdirSync("screenshots", { recursive: true });

async function shoot(page: Page, name: string) {
  // Entrance animations are short, but a capture taken mid-fade looks like a
  // rendering bug rather than a design.
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage: true });
}

test("capture /demo scenarios at 1440px", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto("/demo");
  await expect(
    page.getByRole("heading", { name: "Three outcomes, no sign-in required" }),
  ).toBeVisible();
  await shoot(page, "demo-overview");

  await page.getByRole("tab", { name: /Insufficient evidence/ }).click();
  await expect(page.getByRole("heading", { name: "Marcus Webb" })).toBeVisible();
  await shoot(page, "demo-insufficient-evidence");

  await page.getByRole("tab", { name: /Shadow evaluation/ }).click();
  await expect(page.getByText("Watched, not acted on")).toBeVisible();
  await shoot(page, "demo-shadow");
});
