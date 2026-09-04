import { getDataMode } from "@/lib/api/mode";
import { resolveAuthContext } from "@/lib/auth/context";
import { AppHeader } from "@/components/AppHeader";
import { MarketingHome } from "@/components/marketing/MarketingHome";

/**
 * The public marketing homepage — deliberately outside the `(app)` route
 * group, so it never goes through that group's auth gate at all. `/` always
 * renders the same composition for every visitor; the only thing resolved
 * here is whether the visitor already has a session, purely to retarget the
 * hero's primary CTA ("Open ARIE" → `/overview` vs "Find customers" →
 * `/discover`) — see `MarketingHome`.
 *
 * Mock mode never has a real session, so it's `authenticated: false`
 * unconditionally rather than paying for an auth check with nothing to
 * resolve.
 */
export default async function RootPage() {
  const authenticated =
    getDataMode() === "api" && (await resolveAuthContext()).state === "authorized";

  return (
    <>
      <AppHeader />
      <main id="content" className="relative z-0 flex-1">
        <MarketingHome authenticated={authenticated} />
      </main>
    </>
  );
}
