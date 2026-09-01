"use client";

import { useState, type FormEvent } from "react";
import { createOrganization } from "@/lib/api/organizations";
import { ArieApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/Button";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { getTurnstileSiteKey } from "@/lib/turnstile";

/**
 * Productization M6 Part 10 — shown inline on `NoOrganizationAccess` for a
 * signed-in, email-verified user with no organization yet. On success, the
 * caller immediately has an owner session over the new organization (the
 * backend created the membership atomically); a full navigation to `/` is
 * what makes `resolveAuthContext()` see it on the very next request, the
 * same reload discipline `LoginPage`'s own comment documents.
 *
 * Cloudflare Turnstile (Part 12) guards this endpoint, which is the one
 * place a valid-but-scripted session could mint organizations in a loop.
 * The widget renders only when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set, and
 * when it is unset the request body is byte-for-byte what it was before —
 * no `turnstile_token` key at all — so local dev and CI keep working against
 * a backend whose own secret is equally unset. Configure the two halves
 * together or not at all; see `@/lib/turnstile`.
 */
export function CreateOrganizationForm() {
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const siteKey = getTurnstileSiteKey();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await createOrganization(
        siteKey ? { name: name.trim(), turnstile_token: turnstileToken } : { name: name.trim() },
      );
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof ArieApiError ? err.message : String(err));
      setPending(false);
      // The challenge is consumed whether or not the request succeeded, so a
      // retry needs a fresh one rather than a replay the backend will reject.
      setTurnstileToken(null);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 text-left">
      <label htmlFor="new-org-name" className="t-label text-text-dim">
        Organization name
      </label>
      <input
        id="new-org-name"
        type="text"
        required
        minLength={1}
        maxLength={200}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Acme Inc."
        className="input w-full"
      />
      {siteKey && (
        <TurnstileWidget
          siteKey={siteKey}
          onToken={setTurnstileToken}
          action="create-organization"
        />
      )}
      {error && (
        <p role="alert" className="text-sm leading-relaxed text-reject">
          {error}
        </p>
      )}
      <Button
        type="submit"
        variant="primary"
        disabled={pending || !name.trim() || (siteKey !== null && turnstileToken === null)}
        className="w-full"
      >
        {pending ? "Creating…" : "Create organization"}
      </Button>
    </form>
  );
}
