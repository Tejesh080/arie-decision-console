"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getDataMode } from "@/lib/api/mode";
import { acceptInvitation } from "@/lib/api/invitations";
import { ArieApiError } from "@/lib/api/errors";
import { Wordmark } from "@/components/brand/Mark";
import { Panel, Eyebrow } from "@/components/ui/Panel";
import { Button, ButtonLink } from "@/components/ui/Button";

type Phase = "checking" | "needs_signin" | "accepting" | "success" | "error";

/**
 * Handles every terminal state `POST /invitations/accept` can produce
 * (`arie.invitations`): 404 invalid/already-resolved (also covers replay —
 * the backend deliberately collapses that case for IDOR-safety, so this
 * screen must not claim to know which of those it was), 410 expired, 403
 * email mismatch. Never renders organization details for an invalid token.
 */
function messageForError(err: unknown): string {
  if (err instanceof ArieApiError) {
    if (err.status === 404) {
      return "This invitation link is invalid, has already been used, or was revoked.";
    }
    if (err.status === 410) {
      return "This invitation has expired. Ask an organization admin to send a new one.";
    }
    if (err.status === 403) {
      return "This invitation was sent to a different email address than the one you're signed in with.";
    }
    return err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

export function InviteAcceptView({ token }: { token: string | null }) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [error, setError] = useState<string | null>(null);
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signInPending, setSignInPending] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const attempted = useRef(false);

  async function attemptAccept(activeToken: string) {
    setPhase("accepting");
    setError(null);
    try {
      await acceptInvitation({ token: activeToken });
      setPhase("success");
    } catch (err) {
      setError(messageForError(err));
      setPhase("error");
    }
  }

  useEffect(() => {
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("This invitation link is missing its token.");
      setPhase("error");
      return;
    }
    let cancelled = false;

    // Mock mode has no real Supabase project configured (see
    // `createClient`'s docstring) and no login wall anywhere else in the
    // app — `acceptInvitation` already routes to the in-memory mock store
    // for this data mode, so there's nothing to sign in to.
    if (getDataMode() !== "api") {
      if (!attempted.current) {
        attempted.current = true;
        void attemptAccept(token);
      }
      return;
    }

    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      if (data.user) {
        if (!attempted.current) {
          attempted.current = true;
          void attemptAccept(token);
        }
      } else {
        setPhase("needs_signin");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSignIn(event: FormEvent) {
    event.preventDefault();
    setSignInPending(true);
    setSignInError(null);
    const supabase = createClient();
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: signInEmail,
      password: signInPassword,
    });
    setSignInPending(false);
    if (signInErr) {
      setSignInError(signInErr.message);
      return;
    }
    if (token && !attempted.current) {
      attempted.current = true;
      await attemptAccept(token);
    }
  }

  return (
    <main id="content" className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Wordmark />
        </div>

        <Panel padding="lg">
          <Eyebrow>Organization invitation</Eyebrow>

          {phase === "checking" && <p className="mt-3 text-sm text-text-faint">Checking…</p>}

          {phase === "needs_signin" && (
            <>
              <h1 className="t-h3 mt-2 text-text">Sign in to accept</h1>
              <p className="mt-2 text-sm text-text-dim">
                Sign in with the email address this invitation was sent to.
              </p>
              <form onSubmit={handleSignIn} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="invite-email" className="t-label text-text-dim">
                    Email
                  </label>
                  <input
                    id="invite-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    className="input mt-1.5 w-full"
                  />
                </div>
                <div>
                  <label htmlFor="invite-password" className="t-label text-text-dim">
                    Password
                  </label>
                  <input
                    id="invite-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    className="input mt-1.5 w-full"
                  />
                </div>
                {signInError && (
                  <p role="alert" className="text-sm leading-relaxed text-reject">
                    {signInError}
                  </p>
                )}
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={signInPending}
                  className="w-full"
                >
                  {signInPending ? "Signing in…" : "Sign in and accept"}
                </Button>
              </form>
            </>
          )}

          {phase === "accepting" && (
            <p className="mt-3 text-sm text-text-faint">Accepting invitation…</p>
          )}

          {phase === "success" && (
            <>
              <div className="mt-3 flex items-center gap-2 text-qualify">
                <CircleCheck className="h-5 w-5 shrink-0" strokeWidth={2.25} />
                <p className="text-sm font-medium">You&apos;ve joined the organization.</p>
              </div>
              <ButtonLink href="/" variant="primary" className="mt-5 w-full">
                Go to the console
              </ButtonLink>
            </>
          )}

          {phase === "error" && (
            <>
              <div className="mt-3 flex items-start gap-2 text-reject">
                <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2.25} />
                <p className="text-sm leading-relaxed">{error}</p>
              </div>
              <ButtonLink href="/" variant="secondary" className="mt-5 w-full">
                Back to the console
              </ButtonLink>
            </>
          )}
        </Panel>
      </div>
    </main>
  );
}
