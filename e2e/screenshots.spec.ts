import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * Visual QA capture at the three required breakpoints (P4 brief, section
 * 21). Not assertions about pixel content -- just produces the artifacts a
 * human reviews during the refinement passes. Screenshots land in
 * `screenshots/` (gitignored).
 */
const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "1280", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
];

test.beforeAll(() => {
  mkdirSync("screenshots", { recursive: true });
});

async function shoot(page: Page, viewportName: string, stateName: string) {
  await page.screenshot({
    path: `screenshots/${viewportName}-${stateName}.png`,
    fullPage: true,
  });
}

for (const viewport of VIEWPORTS) {
  test(`capture key states at ${viewport.name}px`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    await page.goto("/");
    await shoot(page, viewport.name, "dashboard");

    await page.goto("/leads/new");
    await shoot(page, viewport.name, "new-lead-form");

    await page.getByRole("button", { name: "Nadia Delacroix — autonomous" }).click();
    await page.getByRole("button", { name: "Submit lead" }).click();
    await page.waitForURL(/\/leads\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    await expect(page.getByText("Auto-routed", { exact: true })).toBeVisible();
    await shoot(page, viewport.name, "receipt-autonomous");

    await page.goto("/leads/new");
    await page.getByRole("button", { name: "Nadia Haddad — human escalation" }).click();
    await page.getByRole("button", { name: "Submit lead" }).click();
    await page.waitForURL(/\/leads\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    await expect(page.getByText("Human review required")).toBeVisible();
    await shoot(page, viewport.name, "receipt-pending-review");

    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await page.getByRole("button", { name: "Submit decision" }).click();
    await page.getByRole("button", { name: "Confirm approve" }).click();
    await expect(page.getByText(/Human override/)).toBeVisible();
    // The final-outcome stage fades/scales in (motion.div); toBeVisible()
    // above only confirms it's in the DOM, not that the entrance animation
    // finished -- without this the capture catches it mid-fade.
    await page.waitForTimeout(500);
    await shoot(page, viewport.name, "receipt-resolved-review");
  });
}
