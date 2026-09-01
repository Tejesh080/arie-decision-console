"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Wordmark } from "@/components/brand/Mark";
import { Panel, Eyebrow } from "@/components/ui/Panel";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CircleCheck } from "lucide-react";

/**
 * Productization M6 Part 17 — self-service signup. Email + password only,
 * matching `LoginPage`'s own choice (no magic link/OAuth redirect URL to
 * register). Creates the Supabase Auth user; organization creation is a
 * separate step (`CreateOrganizationForm`, shown by `NoOrganizationAccess`
 * once signed in) — this page's only job is producing a verified identity.
 *
 * Cloudflare Turnstile (Part 12): Supabase Auth has its own native CAPTCHA
 * integration — enable it in Supabase Dashboard -> Authentication ->
 * Attack Protection, then pass the widget's response token here as
 * `options.captchaToken` on `signUp()`. Left as a documented seam
 * (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`) rather than a live widget: no
 * Cloudflare site key exists yet to render or test against, and Part 12 is
 * explicit that this must not block M6 development. The backend repo's
 * `docs/deployment.md` ("The commercial layer") carries the production
 * setup steps for all three third-party accounts.
 */
export function SignupView() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo:
          typeof window !== "undefined" ? `${window.location.origin}/login` : undefined,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setPending(false);
      return;
    }

    if (!data.session) {
      // Supabase project requires email confirmation before a session is
      // issued — the common, safer default. Nothing to navigate to yet.
      setCheckEmail(true);
      setPending(false);
      return;
    }

    // Email confirmation is disabled on this project — a session already
    // exists. Full navigation so middleware/resolveAuthContext see it.
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
          <Eyebrow>Create account</Eyebrow>

          {checkEmail ? (
            <>
              <div className="mt-3 flex items-center gap-2 text-qualify">
                <CircleCheck className="h-5 w-5 shrink-0" strokeWidth={2.25} />
                <p className="text-sm font-medium">Check your email</p>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-text-dim">
                We sent a confirmation link to {email}. Follow it to finish creating your account.
              </p>
              <ButtonLink href="/login" variant="secondary" className="mt-5 w-full">
                Back to sign in
              </ButtonLink>
            </>
          ) : (
            <>
              <h1 className="t-h3 mt-2 text-text">Create your ARIE account</h1>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="signup-email" className="t-label text-text-dim">
                    Email
                  </label>
                  <input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input mt-1.5 w-full"
                  />
                </div>

                <div>
                  <label htmlFor="signup-password" className="t-label text-text-dim">
                    Password
                  </label>
                  <input
                    id="signup-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
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

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={pending}
                  className="w-full"
                >
                  {pending ? "Creating account…" : "Create account"}
                </Button>
              </form>

              <p className="mt-5 text-center text-xs text-text-faint">
                Already have an account?{" "}
                <a href="/login" className="text-machine hover:underline">
                  Sign in
                </a>
              </p>
            </>
          )}
        </Panel>
      </div>
    </main>
  );
}
