import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — bypasses RLS entirely, exactly like the
 * ARIE backend's own pooled Postgres connection does
 * (`migrations/0016_row_level_security.sql`'s own docstring: "the API's
 * pooled connection is a service-role/superuser and bypasses this").
 *
 * `import "server-only"` makes it a build error for any client component to
 * import this module, on top of the key itself never carrying a
 * `NEXT_PUBLIC_` prefix (so Next.js would never inline it into a browser
 * bundle even by accident). Used for exactly one thing today: looking up
 * `organization_members` for a user whose identity has *already* been
 * verified via their own JWT (`resolveAuthContext`'s `getUser()` call) —
 * never for a client-supplied id, which would be the actual privilege
 * escalation this pattern exists to avoid.
 *
 * Why this exists instead of the plain RLS-scoped client: `organization_members`
 * carries a `FOR ALL` policy (`org_members_write`) whose `USING` clause calls
 * `arie_has_role()`, which itself queries `organization_members` — and
 * because that function is `SECURITY INVOKER`, not `SECURITY DEFINER`, the
 * inner query is subject to the very same policy, which calls
 * `arie_has_role()` again. Infinite recursion (`stack depth limit exceeded`),
 * confirmed directly against the database, not assumed. That's a backend
 * schema defect (the helper functions need `SECURITY DEFINER`) outside this
 * task's scope to fix — this client is the safe workaround until it is.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
