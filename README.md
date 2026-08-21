# ARIE Decision Console

The frontend for the [Adaptive Revenue Intelligence Engine](https://github.com/Tejesh080/Adaptive-Revenue-Intelligence-Engine) — submit a lead, watch it move through evidence, scoring, and a decision, and see exactly why ARIE stopped where it did. When ARIE escalates a decision to a human, this is where that review happens: the machine's recommendation, the human's action, and the final outcome stay visible together, never collapsed into one.

Next.js 16 (App Router) + TypeScript + Tailwind CSS v4. No CRM UI, no auth, no real enrichment providers — see [Non-goals](#non-goals).

---

## Two ways to run it

### Mock mode (default — no backend required)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Mock mode reproduces the app's full shape — bounded processing, real optimistic-concurrency and idempotency semantics on review decisions — against realistic, fabricated data, persisted to `localStorage` so a browser refresh reconstructs state exactly the way "api" mode does from the real backend. No `.env.local` needed; `NEXT_PUBLIC_ARIE_DATA_MODE` defaults to `mock` when unset. Good for screenshots, portfolio preview, and UI work without Docker.

### Real ARIE mode

**Prerequisite: the ARIE backend running locally at `http://localhost:8000`.** In the [`adaptive-revenue-intelligence-engine`](https://github.com/Tejesh080/Adaptive-Revenue-Intelligence-Engine) repo (a sibling checkout, not part of this repo):

```powershell
docker compose up -d
```

Then, in this repo:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```dotenv
NEXT_PUBLIC_ARIE_DATA_MODE=api
NEXT_PUBLIC_ARIE_API_BASE_URL=http://localhost:8000
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the connection status badge in the header confirms it can reach ARIE.

**Why a proxy, not direct browser calls.** The ARIE backend has no CORS middleware (confirmed against its source, not assumed), so a browser calling `http://localhost:8000` directly from a different origin would be blocked. Every request instead goes to this app's own server-side Route Handlers under `src/app/api/arie/*`, which forward to the backend server-to-server, where CORS doesn't apply. `NEXT_PUBLIC_ARIE_API_BASE_URL` is read there, and nowhere else — no component ever hardcodes `localhost:8000`.

**Mode never silently falls back.** If `NEXT_PUBLIC_ARIE_DATA_MODE=api` and the backend is unreachable, the UI shows a clear "ARIE backend unavailable" state with a retry button — it does not quietly serve mock data instead, which would be indistinguishable from a real (if unlikely) result.

---

## Human review demo

The clearest way to see the whole product thesis — a machine recommendation that isn't automatically actionable, and a human decision that becomes the record of what actually happened without erasing what the machine said.

1. Start either mode above.
2. Go to **New lead**, click the **Nadia Haddad — human escalation** preset, and submit.
3. ARIE evaluates all 8 providers and still can't clear its autonomy threshold — the receipt shows the machine's recommendation (**Reject**), why it isn't autonomous, and a **Human review required** panel.
4. Pick **Reviewer**, choose **Approve** (or **Reject**, or **Edit** with required notes), click **Submit decision**, then confirm.
5. The page updates to show all three stages at once: **Machine recommendation → Human action → Final outcome**, with a **Human override** badge — the recommendation was Reject, the outcome is Auto-routed, and both stay visible.
6. Refresh the browser. The same state comes back — reconstructed from the backend (or, in mock mode, from `localStorage`), not from in-memory UI state that a reload would lose.

The **Nadia Delacroix — autonomous** preset shows the other path: enough evidence, high enough confidence, no human involved at all.

---

## Shadow mode

A third path, distinct from both of the above: check **Shadow mode** on the New Lead form before submitting. ARIE still runs the full evidence/scoring/confidence pipeline and computes a real recommendation — but takes no authoritative action. No auto-route, no reject, no human review opened. The receipt renders this as a dedicated **Shadow evaluation** panel ("Would have recommended: …"), with its own status color, never presented as if it were a real `AUTO_ROUTED`/`AWAITING_HUMAN` outcome. This is what lets ARIE sit alongside an existing workflow and prove its recommendations before ever controlling anything.

---

## Architecture

```
src/lib/api/
  types.ts        Types mirroring the backend's public HTTP contract exactly
  mode.ts         "mock" | "api", from NEXT_PUBLIC_ARIE_DATA_MODE
  errors.ts       Typed error hierarchy (NotFound / Conflict / Validation / Unavailable / Timeout)
  client.ts       Low-level fetch wrapper — only ever calls this app's own /api/arie/* proxy
  leads.ts, receipts.ts, reviews.ts, health.ts
                  One typed function per backend operation; each checks the
                  mode and delegates to client.ts (api) or mock/store.ts (mock)
  polling.ts      Bounded polling for a lead to leave the auto-advancing state chain
  server/proxy.ts Server-only forwarding to the real backend (Route Handlers only)
  mock/store.ts   Mock mode's entire fabricated "backend", localStorage-backed

src/app/api/arie/ Route Handlers proxying 1:1 to the backend's endpoints
src/components/    UI — receipt/ holds the gauges, evidence panel, and review panel
src/lib/format/    Display formatting + the LeadStatus -> label / badge-tone mappings
```

Every API call goes through the typed functions in `src/lib/api/` — no component constructs a fetch URL or reads `NEXT_PUBLIC_ARIE_API_BASE_URL` directly.

### Backend endpoints integrated

`POST /leads`, `GET /leads/{id}`, `GET /leads/{id}/receipt`, `GET /reviews/{id}`, `POST /reviews/{id}/decision`, `GET /healthz` — confirmed against the backend's own source (`src/arie/api/schemas.py`, `src/arie/core/types.py`, `src/arie/approval/workflow.py`), not guessed. The backend has no endpoint to list leads server-side, so the dashboard's "recently submitted" list is explicitly local browser history, not a claim about server state.

---

## Scripts

```bash
npm run dev          # start the dev server
npm run build         # production build
npm run lint          # ESLint
npm run typecheck     # tsc --noEmit
npm run test           # Vitest (unit/component)
npm run test:e2e       # Playwright — see e2e/ (run the dev server first, in the mode you want to test)
```

---

## Deploy to Vercel

The app is a stateless Next.js frontend with one server-side dependency: the ARIE backend's public URL. No database, no secrets of its own.

1. [Import this repo](https://vercel.com/new) into Vercel. Framework preset (Next.js) and build settings are auto-detected — leave them as-is.
2. Add one environment variable:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_ARIE_API_BASE_URL` | The backend's public URL — see [its own hosted-deployment docs](https://github.com/Tejesh080/Adaptive-Revenue-Intelligence-Engine#hosted-deployment) |

   Leave `NEXT_PUBLIC_ARIE_DATA_MODE` unset for mock mode (safe default, no backend dependency at all), or set it to `api` once you want the deployed app to talk to the real hosted backend.
3. Deploy. Nothing else is required — the same server-side proxy architecture (`src/app/api/arie/*`) that talks to a local Docker backend talks to the hosted one identically; only the URL changes.

Never add `DATABASE_URL`, `DATABASE_DIRECT_URL`, or any provider API key here — this app never needs them and never sees them; only the backend does.

---

## Non-goals

Auth, users, teams, multi-tenancy, billing, CRM/OAuth integrations, real enrichment providers. Production *hosting* (Vercel, above) is in scope; a production *security posture* — auth, tenancy, rate limiting — is not.
