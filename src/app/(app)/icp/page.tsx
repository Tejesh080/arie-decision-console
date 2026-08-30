import { getDataMode } from "@/lib/api/mode";
import { resolveAuthContext } from "@/lib/auth/context";
import { ICPConfigView } from "@/components/icp/ICPConfigView";

/**
 * Thin server wrapper so `ICPConfigView` (a client component — it fetches
 * through the same-origin `/api/arie/*` proxy, which needs a browser
 * context) knows whether to render the edit form at all. `canEdit` is a
 * courtesy the UI acts on, not the real gate: `POST /organization/icp`
 * enforces owner/admin independently server-side regardless of what this
 * page decided to render.
 *
 * Mock mode has no Supabase session to check at all (the whole app has no
 * login wall there) — every mock visitor can edit, matching every other
 * mock-mode screen's "no auth wall" behaviour.
 */
export default async function ICPPage() {
  let canEdit = true;
  if (getDataMode() === "api") {
    const auth = await resolveAuthContext();
    canEdit = auth.state === "authorized" && (auth.role === "owner" || auth.role === "admin");
  }
  return <ICPConfigView canEdit={canEdit} />;
}
