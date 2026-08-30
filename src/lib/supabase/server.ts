import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client bound to this request's cookies — used by
 * Route Handlers and Server Components, never by client components (which
 * use `src/lib/supabase/client.ts` instead).
 *
 * `setAll` can throw when called from a Server Component (there's no
 * response to attach a `Set-Cookie` header to) — that's expected and safe
 * to swallow here, because `middleware.ts` refreshes the session cookie on
 * every request regardless.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — see docstring above.
          }
        },
      },
    },
  );
}
