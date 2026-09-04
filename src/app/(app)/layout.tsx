import { AppHeader } from "@/components/AppHeader";
import { NoOrganizationAccess } from "@/components/NoOrganizationAccess";
import { resolveAuthContext } from "@/lib/auth/context";
import { getDataMode } from "@/lib/api/mode";

/**
 * The authenticated console. `middleware.ts` redirects a signed-out request
 * to `/login` before it gets here, for every route except `/` — the public
 * marketing homepage. That invariant is what makes the `unauthenticated`
 * state below safe to render rather than redirect: reaching this layout
 * unauthenticated can only happen on `/`, so falling through to the normal
 * render (rather than bouncing to `/login`) is exactly right — `(app)/page.tsx`
 * shows the marketing page itself when there's no session, and the customer
 * dashboard when there is.
 *
 * What this layout *does* still need to resolve itself is the second check
 * middleware can't do cheaply: signed in, but no active `organization_members`
 * row. That's resolved here, once, via the same `resolveAuthContext()` the
 * API proxy uses — so the page gate and the data it's guarding can never
 * disagree about who's authorized.
 *
 * Skipped entirely outside `api` data mode, matching `middleware.ts` — see
 * that file's docstring for why "mock" mode must never require a real
 * Supabase login.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (getDataMode() !== "api") {
    return (
      <>
        <AppHeader />
        <main id="content" className="relative z-0 flex-1">
          {children}
        </main>
      </>
    );
  }

  const auth = await resolveAuthContext();

  if (auth.state === "no_organization") {
    return <NoOrganizationAccess />;
  }

  return (
    <>
      <AppHeader />
      <main id="content" className="relative z-0 flex-1">
        {children}
      </main>
    </>
  );
}
