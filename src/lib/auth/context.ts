import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The one place a request's session and organization membership are
 * resolved — used by both the backend proxy (`api/server/proxy.ts`) and the
 * page-level access gate (`app/(app)/layout.tsx`), so they can never
 * disagree about who is authorized for what.
 *
 * Organization membership is looked up in `organization_members`, but via
 * the service-role admin client (`@/lib/supabase/admin`), not the plain
 * RLS-scoped session client — see that module's docstring for why the RLS
 * path recurses infinitely for this exact table. The lookup is still
 * strictly scoped to `user.id`, which comes from `getUser()`'s own
 * server-verified identity, never from anything client-supplied, so this
 * doesn't weaken isolation: it's the same "verify identity, then use a
 * privileged connection scoped to that identity" pattern the ARIE backend
 * itself uses.
 */
export type AuthContext =
  | { state: "unauthenticated" }
  | { state: "no_organization"; userId: string }
  | { state: "authorized"; userId: string; accessToken: string; organizationId: string };

/**
 * `getUser()` (not `getSession()`) verifies the session against Supabase's
 * Auth server rather than trusting the cookie's claims unauthenticated —
 * Supabase's own guidance for server-side code. Once that identity is
 * confirmed, `getSession()` is safe to read purely for the access-token
 * string to forward to the backend.
 */
export async function resolveAuthContext(): Promise<AuthContext> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { state: "unauthenticated" };

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { state: "unauthenticated" };

  // Deterministic pick (oldest membership first) rather than an
  // organization switcher: every user in this deployment belongs to exactly
  // one organization today, and a picker for a case that doesn't exist yet
  // would be unused UI, not a feature.
  const admin = createAdminClient();
  const { data: memberships, error } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1);

  // Never collapse a query failure into "no organization" — that's exactly
  // the bug that made an RLS recursion error on the backend look like a
  // real membership gap. Treat it as unauthenticated instead: the caller's
  // identity checked out, but this request cannot honestly say what they're
  // authorized for, and unauthenticated is the safe direction to be wrong.
  if (error) {
    console.error("resolveAuthContext: organization_members lookup failed", error);
    return { state: "unauthenticated" };
  }

  const organizationId = memberships?.[0]?.organization_id as string | undefined;
  if (!organizationId) return { state: "no_organization", userId: user.id };

  return {
    state: "authorized",
    userId: user.id,
    accessToken: session.access_token,
    organizationId,
  };
}
