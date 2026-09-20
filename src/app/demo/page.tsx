import { Suspense } from "react";
import type { Metadata } from "next";
import { DemoView } from "@/components/demo/DemoView";

/**
 * The one route in this app that is permanently public and never touches a
 * backend: no Supabase session, no cookies, no `/api/arie/*` call, and no
 * possibility of creating a lead, job, or any other persisted row — see
 * `src/lib/demo/scenarios.ts` for the frozen data and `middleware.ts`'s
 * `onDemoPage` exemption for how this stays reachable in `api` data mode,
 * where every other route under `middleware.ts`'s matcher requires a
 * session.
 *
 * Deliberately outside the `(app)` route group — `(app)/layout.tsx`'s auth
 * gate never runs for this page, and this page must never be moved inside
 * that group.
 */
export const metadata: Metadata = {
  title: "Demo — ARIE Decision Console",
  description:
    "Three frozen decision receipts — confident auto-route, insufficient evidence sent to human review, and a shadow evaluation — with no sign-in required.",
};

export default function DemoPage() {
  // DemoView reads `?scenario=` (via useSearchParams) so DemoCards on the
  // homepage can deep-link into a specific outcome; that hook opts the tree
  // into client rendering unless it sits behind a Suspense boundary — same
  // pattern as NewLeadForm's `?run=`.
  return (
    <Suspense fallback={<div className="skeleton h-[28rem] w-full rounded-xl" />}>
      <DemoView />
    </Suspense>
  );
}
