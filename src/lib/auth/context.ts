import { createClient } from "@/lib/supabase/server";

/**
 * The one place a request's session and organization membership are
 * resolved — used by both the backend proxy (`api/server/proxy.ts`) and the
 * page-level access gate (`app/(app)/layout.tsx`), so they can never
 * disagree about who is authorized for what.
 *
 * Organization membership is looked up in `organization_members` through the
 * same RLS-scoped session client used for everything else — no service-role
 * key involved. That table's RLS policies previously recursed infinitely for
 * any non-bypassing client (`arie_has_role()`/`arie_current_organization_ids()`
 * were `SECURITY INVOKER` and queried the very table their own policies
 * guard); the backend's `migrations/0018_fix_rls_membership_recursion.sql`
 * made both `SECURITY DEFINER`, which was this app's own workaround
 * (`@/lib/supabase/admin`'s service-role client) until then. Direct RLS
 * access is now verified working end-to-end, so the workaround is retired.
 */
export type AuthContext =
  | { state: "unauthenticated" }
  | { state: "no_organization"; userId: string }
  | {
      state: "authorized";
      userId: string;
      accessToken: string;
      organizationId: string;
      /** Productization M3. Server Components use this to decide what to
       * render (e.g. the ICP configuration edit form is owner/admin-only) —
       * it is never sent to the backend, which derives its own authorization
       * from the JWT independently (`arie.auth.AuthContext.is_org_admin`).
       * A UI check here is a courtesy, not the real gate. */
      role: string;
    };

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
  const { data: memberships, error } = await supabase
    .from("organization_members")
    .select("organization_id, role")
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
  const role = memberships?.[0]?.role as string | undefined;
  if (!organizationId || !role) return { state: "no_organization", userId: user.id };

  return {
    state: "authorized",
    userId: user.id,
    accessToken: session.access_token,
    organizationId,
    role,
  };
}
