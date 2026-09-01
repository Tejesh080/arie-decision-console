/**
 * Productization M6 Part 12 — the public half of Cloudflare Turnstile.
 *
 * The site key is public by design: it is rendered into the page so
 * Cloudflare's widget can identify which site is challenging. Its secret
 * counterpart (`TURNSTILE_SECRET_KEY`) lives only in the backend process and
 * must never appear in this repository or in a `NEXT_PUBLIC_` variable — see
 * `arie.turnstile`'s own module docstring in the backend repo.
 *
 * Unset is a supported state, not a broken one. Absent a site key this
 * console renders no widget and sends no `turnstile_token`, which matches the
 * backend's own documented dev/CI seam (`TURNSTILE.configured === false`
 * accepts a request with no token). The two halves must therefore be
 * configured together: a backend with a secret set and a frontend without a
 * site key would reject every provisioning attempt with a 403.
 */
export function getTurnstileSiteKey(): string | null {
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  return key ? key : null;
}
