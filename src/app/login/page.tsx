"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Wordmark } from "@/components/brand/Mark";
import { Panel, Eyebrow } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";

/**
 * Email + password only — no magic link, no OAuth. Both would need a
 * redirect URL registered in Supabase's own Auth settings before they work
 * at all; password auth needs nothing beyond the anon key this app already
 * has, and every ARIE organization member already has a password (set the
 * same way any Supabase Auth user's is).
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setPending(false);
      return;
    }

    // Full navigation: the middleware needs to see the new session cookie
    // on the very next request to stop redirecting here.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/");
  }

  return (
    <main id="content" className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Wordmark />
        </div>

        <Panel padding="lg">
          <Eyebrow>Sign in</Eyebrow>
          <h1 className="t-h3 mt-2 text-text">ARIE Decision Console</h1>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="t-label text-text-dim">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input mt-1.5 w-full"
              />
            </div>

            <div>
              <label htmlFor="password" className="t-label text-text-dim">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input mt-1.5 w-full"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm leading-relaxed text-reject">
                {error}
              </p>
            )}

            <Button type="submit" variant="primary" size="lg" disabled={pending} className="w-full">
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-5 text-center text-xs text-text-faint">
            Don&apos;t have an account?{" "}
            <a href="/signup" className="text-machine hover:underline">
              Create one
            </a>
          </p>
        </Panel>
      </div>
    </main>
  );
}
