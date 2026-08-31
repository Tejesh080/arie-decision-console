import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Two jobs, both required by Supabase's own SSR pattern:
 *
 * 1. Refresh the session cookie on every request — without this, a session
 *    silently expires mid-visit instead of being renewed underneath the
 *    user.
 * 2. Gate page navigation: signed out and not already headed to `/login`
 *    gets redirected there; signed in and sitting on `/login` gets sent to
 *    the console instead.
 *
 * `/api/arie/*` is excluded by the matcher below on purpose — those routes
 * answer with JSON, and a 307 redirect to an HTML login page would break
 * that contract. They resolve and enforce auth independently, via the same
 * `resolveAuthContext()` this middleware's redirect logic mirrors.
 *
 * `/invite/accept` is also let through signed-out, like `/login` — its whole
 * point is to be reachable by someone who followed an invitation link before
 * ever signing in. The page itself renders an inline sign-in affordance and
 * only calls `POST /invitations/accept` once a session exists; the backend
 * independently verifies the invited email matches the signed-in identity.
 *
 * A no-op entirely outside `api` data mode: "mock" mode is a fabricated,
 * client-side-only demo with no real backend and nothing to protect —
 * gating it behind a real Supabase login would break the zero-config
 * portfolio/screenshot use case `README.md` documents, for no security
 * benefit.
 */
export async function middleware(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_ARIE_DATA_MODE !== "api") {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const onLoginPage = request.nextUrl.pathname === "/login";
  const onInviteAcceptPage = request.nextUrl.pathname === "/invite/accept";

  if (!user && !onLoginPage && !onInviteAcceptPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && onLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
