import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client — used only by the login form and sign-out.
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY` is meant to be public: Row Level Security
 * on the database, not secrecy of this key, is what protects data. The
 * service-role key and `SUPABASE_JWT_SECRET` never reach this repo at all.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
