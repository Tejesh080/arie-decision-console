import { expect, test } from "@playwright/test";

/**
 * The A→Z validation matrix for the public-demo UX pass: arbitrary manual
 * leads, duplicate-submit protection, refresh recovery, invalid IDs, forced
 * API failures, and mobile. Everything here runs in mock mode (which
 * reproduces the hosted backend's semantics, including hash-routing
 * arbitrary identities) except where a spec says otherwise; the same flows
 * are smoke-tested against production after deploy.
 */

test("the new-lead form exposes no delivery plumbing and generates it instead", async ({
  page,
}) => {
  let submittedBody: Record<string, unknown> | null = null;
  await page.route("**/api/arie/leads", async (route) => {
    if (route.request().method() === "POST") {
      submittedBody = route.request().postDataJSON() as Record<string, unknown>;
    }
    await route.fallback();
  });

  await page.goto("/leads/new");

  // The implementation-detail fields are gone from the visible form…
  await expect(page.getByLabel(/Source/)).toHaveCount(0);
  await expect(page.getByLabel(/External ref/)).toHaveCount(0);
  await expect(page.getByText("Deterministic identities")).toHaveCount(0);
  await expect(page.getByText(/POST \/leads/)).toHaveCount(0);

  // …and the human fields are what remain.
  await page.getByLabel(/Email/).fill("morgan.avery@bluecedar.io");
  await page.getByLabel(/Full name/).fill("Morgan Avery");
  await page.getByLabel(/Company domain/).fill("https://www.bluecedar.io/pricing");
  await page.getByRole("button", { name: "Evaluate lead" }).click();
  await page.waitForURL(/\/leads\/[0-9a-f-]{36}$/, { timeout: 30_000 });

  // The plumbing was supplied by the site, not the visitor — and the pasted
  // URL was normalized to a bare domain before it ever left the browser.
  expect(submittedBody).not.toBeNull();
  expect(submittedBody!.source).toBe("arie-web");
  expect(String(submittedBody!.external_ref)).toMatch(/^web-[0-9a-f-]{36}$/);
  expect(submittedBody!.company_domain).toBe("bluecedar.io");
});

test("an arbitrary manual lead runs end to end and reads as a receipt", async ({ page }) => {
  await page.goto("/leads/new");
  await page.getByLabel(/Email/).fill("dana.kimura@thornfield-analytics.com");
  await page.getByLabel(/Full name/).fill("Dana Kimura");
  await page
    .getByLabel(/Company/, { exact: false })
    .first()
    .fill("Thornfield Analytics");
  await page.getByRole("button", { name: "Evaluate lead" }).click();

  await page.waitForURL(/\/leads\/[0-9a-f-]{36}$/, { timeout: 30_000 });

  // Whatever branch the identity hashes to, the receipt answers the core
  // questions a first-time human has.
  await expect(page.getByText("What happened", { exact: true })).toBeVisible({ timeout: 75_000 });
  await expect(page.getByText("Why ARIE stopped", { exact: true })).toBeVisible();
  await expect(page.getByText("What it used", { exact: true })).toBeVisible();
  await expect(page.getByText("Dana Kimura").first()).toBeVisible();
});

test("double-clicking Evaluate cannot create two leads", async ({ page }) => {
  const postedRefs: string[] = [];
  await page.route("**/api/arie/leads", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as { external_ref?: string };
      postedRefs.push(String(body.external_ref));
    }
    await route.fallback();
  });

  await page.goto("/leads/new");
  await page.getByLabel(/Email/).fill("double.click@rapidfire.example");
  const evaluate = page.getByRole("button", { name: "Evaluate lead" });
  // Two clicks as fast as Playwright can issue them. The second is not
  // awaited before the navigation check: it may legitimately spend forever
  // waiting on a button that disabled and then unmounted — which is the
  // protection under test, not a failure of it.
  await evaluate.click();
  const second = evaluate.click({ force: true, timeout: 2_000 }).catch(() => {
    /* disabled or unmounted — exactly the point */
  });

  await page.waitForURL(/\/leads\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  await second;

  // At most one POST reached the API; if a second ever did, its idempotent
  // external_ref would have made it the same lead anyway.
  expect(postedRefs.length).toBeLessThanOrEqual(1 + 0);
  expect(new Set(postedRefs).size).toBe(1);
});

test("refreshing mid-processing recovers to the same lead, not a dead end", async ({ page }) => {
  await page.goto("/leads/new");
  await page.getByLabel(/Email/).fill("refresh.survivor@midflight.example");
  await page.getByRole("button", { name: "Evaluate lead" }).click();

  // The URL owns the lead from the first second — reload while (possibly
  // still) processing and the page reconstructs from the backend.
  await page.waitForURL(/\/leads\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const receiptUrl = page.url();
  await page.reload();

  await expect(page).toHaveURL(receiptUrl);
  await expect(page.getByText("What happened", { exact: true })).toBeVisible({ timeout: 75_000 });
});

test("an unknown lead ID shows a clear not-found state, not a crash", async ({ page }) => {
  await page.goto("/leads/00000000-0000-0000-0000-00000000dead");
  await expect(page.getByText(/No such lead/).first()).toBeVisible({ timeout: 15_000 });
});

test("a forced API 500 renders the friendly failure, with details behind a fold", async ({
  page,
}) => {
  await page.route("**/api/arie/leads", async (route) => {
    if (route.request().method() === "POST") {
      // The worst shape the platform can produce: a 500 with an unhelpful
      // JSON body. The form must translate, never parrot.
      await route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
      return;
    }
    await route.fallback();
  });

  await page.goto("/leads/new");
  await page.getByLabel(/Email/).fill("forced.failure@teapot.example");
  await page.getByRole("button", { name: "Evaluate lead" }).click();

  await expect(page.getByText(/We couldn't evaluate this lead/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Technical details")).toBeVisible();
  await expect(page.getByRole("button", { name: /Try again/ })).toBeVisible();
  // The raw status is preserved for whoever wants it — one fold down.
  await page.getByText("Technical details").click();
  await expect(page.getByText(/HTTP 500/)).toBeVisible();
});

test("retrying after a failure reuses the same external_ref (no duplicate on retry)", async ({
  page,
}) => {
  const postedRefs: string[] = [];
  let failFirst = true;
  await page.route("**/api/arie/leads", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as { external_ref?: string };
      postedRefs.push(String(body.external_ref));
      if (failFirst) {
        failFirst = false;
        await route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
        return;
      }
    }
    await route.fallback();
  });

  await page.goto("/leads/new");
  await page.getByLabel(/Email/).fill("retry.same.ref@idempotent.example");
  await page.getByRole("button", { name: "Evaluate lead" }).click();
  await expect(page.getByText(/We couldn't evaluate this lead/)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /Try again/ }).click();
  await page.waitForURL(/\/leads\/[0-9a-f-]{36}$/, { timeout: 30_000 });

  // Same payload, same delivery reference — the retry rides idempotency
  // instead of minting a second lead.
  expect(postedRefs).toHaveLength(2);
  expect(postedRefs[0]).toBe(postedRefs[1]);
});

test("375px mobile: homepage, form, and a receipt hold together with no sideways scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });

  // Polled, not sampled once: entrance animations legitimately translate
  // elements through the viewport edge for a few hundred ms. What must never
  // happen is a *settled* page that scrolls sideways.
  const noSidewaysScroll = async () => {
    await expect
      .poll(
        () =>
          page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          ),
        { timeout: 5_000 },
      )
      .toBeLessThanOrEqual(1);
  };

  await page.goto("/");
  await expect(page.getByRole("link", { name: /Run the demo/ })).toBeVisible();
  await noSidewaysScroll();

  await page.goto("/leads/new");
  await expect(page.getByRole("heading", { name: "Evaluate a lead" })).toBeVisible();
  await noSidewaysScroll();

  await page.getByLabel(/Email/).fill("mobile.check@smallscreen.example");
  await page.getByRole("button", { name: "Evaluate lead" }).click();
  await page.waitForURL(/\/leads\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  await expect(page.getByText("What happened", { exact: true })).toBeVisible({ timeout: 75_000 });
  await noSidewaysScroll();
});
