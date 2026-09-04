import { AppHeader } from "@/components/AppHeader";
import { NoOrganizationAccess } from "@/components/NoOrganizationAccess";
import { resolveAuthContext } from "@/lib/auth/context";
import { AuthStateProvider } from "@/lib/auth/AuthStateContext";
import { getDataMode } from "@/lib/api/mode";

/**
 * The authenticated console. `middleware.ts` redirects a signed-out request
 * to `/login` before it gets here, for every route except `/` — the public
 * marketing homepage. That invariant is what makes the `unauthenticated`
 * state below safe to render rather than redirect: reaching this layout
 * unauthenticated can only happen on `/`, so falling through to the normal
 * render (rather than bouncing to `/login`) is exactly right — `(app)/page.tsx`
 * shows the marketing page itself when there's no session, and the customer
 * dashboard when there is. It knows which via `AuthStateProvider` below,
 * resolved here server-side rather than inferred client-side from whether a
 * dashboard fetch happens to succeed — that avoided a real flash-of-wrong-
 * content on every load (this layout already knows the answer before any
 * client code runs) and a real gap where the server-rendered HTML matched
 * neither state while a client fetch was in flight.
 *
 * What this layout *does* still need to resolve itself is the second check
 * middleware can't do cheaply: signed in, but no active `organization_members`
 * row. That's resolved here, once, via the same `resolveAuthContext()` the
 * API proxy uses — so the page gate and the data it's guarding can never
 * disagree about who's authorized.
 *
 * Skipped entirely outside `api` data mode, matching `middleware.ts` — see
 * that file's docstring for why "mock" mode must never require a real
 * Supabase login. Mock mode has no real session, so it always provides
 * `authenticated={false}` — matching the marketing-homepage experience the
 * rest of this app treats mock mode as.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (getDataMode() !== "api") {
    return (
      <AuthStateProvider authenticated={false}>
        <AppHeader />
        <main id="content" className="relative z-0 flex-1">
          {children}
        </main>
      </AuthStateProvider>
    );
  }

  const auth = await resolveAuthContext();

  if (auth.state === "no_organization") {
    return <NoOrganizationAccess />;
  }

  return (
    <AuthStateProvider authenticated={auth.state === "authorized"}>
      <AppHeader />
      <main id="content" className="relative z-0 flex-1">
        {children}
      </main>
    </AuthStateProvider>
  );
}
