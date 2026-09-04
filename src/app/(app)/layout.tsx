import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { NoOrganizationAccess } from "@/components/NoOrganizationAccess";
import { resolveAuthContext } from "@/lib/auth/context";
import { getDataMode } from "@/lib/api/mode";

/**
 * The authenticated console. `middleware.ts` already redirects a signed-out
 * request to `/login` before it gets here — the `redirect` below is
 * defense-in-depth for a path middleware's matcher doesn't cover, not the
 * primary gate.
 *
 * `/` is not part of this group: the public marketing homepage lives at
 * `src/app/page.tsx`, outside `(app)` entirely, so it never runs this gate
 * and never redirects. Every route in this group — `/overview`, `/discover`,
 * `/leads/*`, etc. — requires a real session in `api` mode, no exceptions.
 *
 * What middleware *can't* do cheaply is the second check: signed in, but no
 * active `organization_members` row. That's resolved here, once, via the
 * same `resolveAuthContext()` the API proxy uses — so the page gate and the
 * data it's guarding can never disagree about who's authorized.
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

  if (auth.state === "unauthenticated") {
    redirect("/login");
  }

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
