import { expect, test, request as playwrightRequest, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * Visual QA capture: the artifacts a human reviews, and the images used in
 * the README and portfolio. Screenshots land in `screenshots/` (gitignored).
 *
 * The four receipt states are created ONCE, through the app's own proxy
 * routes, and then photographed at every breakpoint. Driving the full submit
 * flow per viewport instead would enqueue a dozen leads on a single-worker
 * demo backend and spend most of its time waiting — and the submit flow is
 * already covered end-to-end by `autonomous.spec.ts` / `escalation.spec.ts`,
 * which is where that assertion belongs.
 */

const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "1280", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
];

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const API = `${BASE}/api/arie`;

interface Fixtures {
  autonomous: string;
  shadow: string;
  pendingReview: string;
  resolvedReview: string;
}

let fixtures: Fixtures;

/** Mirrors `IN_PROGRESS_STATUSES` — the statuses the worker auto-advances
 * through, i.e. the ones worth waiting on. */
const IN_PROGRESS = new Set([
  "NEW",
  "IDENTITY_RESOLVED",
  "SCORING",
  "FETCHING_EVIDENCE",
  "INTEGRATING",
  "DECISION",
]);

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  // Four leads, submitted together and then polled to settlement against a
  // hosted single-worker backend. The escalation identity calls every
  // provider in the catalogue, several slow by design, so this comfortably
  // outlives the 60s per-test default the config sets.
  test.setTimeout(300_000);
  mkdirSync("screenshots", { recursive: true });
  const api = await playwrightRequest.newContext();

  const ref = () => `shots-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  async function submit(body: Record<string, unknown>): Promise<string> {
    const res = await api.post(`${API}/leads`, { data: body });
    expect(res.ok(), `POST /leads failed: ${res.status()}`).toBeTruthy();
    return (await res.json()).lead_id as string;
  }

  async function settle(leadId: string): Promise<Record<string, unknown>> {
    for (let i = 0; i < 60; i++) {
      const res = await api.get(`${API}/leads/${leadId}`);
      const lead = await res.json();
      if (!IN_PROGRESS.has(lead.status)) return lead;
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error(`lead ${leadId} never settled`);
  }

  const DELACROIX = {
    source: "arie-web",
    email: "nadia.delacroix@lumen500.com",
    full_name: "Nadia Delacroix",
    company_domain: "lumen500.com",
  };
  const HADDAD = {
    source: "arie-web",
    email: "nadia.haddad@cobalt500.com",
    full_name: "Nadia Haddad",
    company_domain: "cobalt500.com",
    company_name: "Cobalt500 Ltd",
  };

  const [autonomous, shadow, pendingReview, resolvedReview] = await Promise.all([
    submit({ ...DELACROIX, external_ref: ref() }),
    submit({ ...DELACROIX, external_ref: ref(), mode: "shadow" }),
    submit({ ...HADDAD, external_ref: ref() }),
    submit({ ...HADDAD, external_ref: ref() }),
  ]);

  await Promise.all([autonomous, shadow, pendingReview].map(settle));
  const resolvedLead = await settle(resolvedReview);

  // Approve the fourth so there is a human-override receipt to capture.
  const receiptRes = await api.get(`${API}/leads/${resolvedReview}/receipt`);
  const reviewId = (await receiptRes.json()).human_review?.review_id;
  expect(reviewId, "escalation lead produced no human review").toBeTruthy();
  const decision = await api.post(`${API}/reviews/${reviewId}/decision`, {
    data: {
      action: "approve",
      reviewer: "j.okafor",
      notes: "Verified ICP fit manually; title and firmographics check out.",
      expected_lead_version: resolvedLead.version,
    },
  });
  expect(decision.ok(), `review decision failed: ${decision.status()}`).toBeTruthy();

  fixtures = { autonomous, shadow, pendingReview, resolvedReview };
  await api.dispose();
});

/** The overview and the receipt titles both read this browser-local record;
 * seeding it makes the captures match what a real submitter sees. */
function seedHistory(f: Fixtures) {
  const now = Date.now();
  localStorage.setItem(
    "arie-web:recent-leads:v1",
    JSON.stringify([
      {
        lead_id: f.resolvedReview,
        label: "Nadia Haddad",
        email: "nadia.haddad@cobalt500.com",
        submitted_at: new Date(now - 4 * 60_000).toISOString(),
        is_shadow: false,
      },
      {
        lead_id: f.pendingReview,
        label: "Nadia Haddad",
        email: "nadia.haddad@cobalt500.com",
        submitted_at: new Date(now - 18 * 60_000).toISOString(),
        is_shadow: false,
      },
      {
        lead_id: f.autonomous,
        label: "Nadia Delacroix",
        email: "nadia.delacroix@lumen500.com",
        submitted_at: new Date(now - 52 * 60_000).toISOString(),
        is_shadow: false,
      },
      {
        lead_id: f.shadow,
        label: "Nadia Delacroix",
        email: "nadia.delacroix@lumen500.com",
        submitted_at: new Date(now - 3 * 3600_000).toISOString(),
        is_shadow: true,
      },
    ]),
  );
}

async function shoot(page: Page, viewportName: string, stateName: string) {
  // Entrance animations are short, but a capture taken mid-fade looks like a
  // rendering bug rather than a design.
  await page.waitForTimeout(2600);
  await page.screenshot({
    path: `screenshots/${viewportName}-${stateName}.png`,
    fullPage: true,
  });
}

for (const viewport of VIEWPORTS) {
  test(`capture key states at ${viewport.name}px`, async ({ page }) => {
    // Six navigations, each waiting on a proxied round trip plus a settle
    // pause before the shutter.
    test.setTimeout(180_000);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    // Seed local history first: a receipt opened from this browser shows the
    // name it was submitted under, which is what a real user sees.
    await page.goto("/");
    await page.evaluate(seedHistory, fixtures);

    await page.goto("/leads/new");
    await shoot(page, viewport.name, "new-lead-form");

    await page.goto(`/leads/${fixtures.autonomous}`);
    await expect(page.getByRole("heading", { name: "Auto-route", exact: true })).toBeVisible({
      timeout: 25_000,
    });
    await shoot(page, viewport.name, "receipt-autonomous");

    await page.goto(`/leads/${fixtures.shadow}`);
    await expect(page.getByText("Shadow evaluation").first()).toBeVisible({ timeout: 25_000 });
    await shoot(page, viewport.name, "receipt-shadow");

    await page.goto(`/leads/${fixtures.pendingReview}`);
    await expect(page.getByText("Human review required")).toBeVisible({ timeout: 25_000 });
    await shoot(page, viewport.name, "receipt-pending-review");

    await page.goto(`/leads/${fixtures.resolvedReview}`);
    await expect(page.getByText("Human action —", { exact: false })).toBeVisible({
      timeout: 25_000,
    });
    await shoot(page, viewport.name, "receipt-resolved-review");

    await page.goto("/");
    await page.evaluate(seedHistory, fixtures);
    await page.reload();
    await expect(
      page.getByRole("heading", { level: 2, name: "Recent demo activity" }),
    ).toBeVisible();
    // Each card resolves its own status and cost with a live per-lead fetch.
    // Shooting before those land captures skeleton pills and zeroed counters.
    await expect(page.getByText("Auto-routed").first()).toBeVisible({ timeout: 25_000 });
    await expect(page.getByText("Shadow evaluated").first()).toBeVisible({ timeout: 25_000 });
    await shoot(page, viewport.name, "dashboard");
  });
}
