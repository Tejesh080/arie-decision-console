"use client";

import { useEffect, useRef } from "react";

/**
 * Productization M6 Part 12 — Cloudflare's Turnstile challenge, rendered
 * explicitly rather than by auto-scanning the DOM.
 *
 * Explicit rendering (`?render=explicit` + `turnstile.render(el, …)`) is what
 * makes this safe inside React: the implicit mode scans for `.cf-turnstile`
 * elements once at script load, which races a client component that mounts
 * later and silently renders nothing. Explicit mode also gives back a widget
 * id, so the widget is removed on unmount instead of leaking an iframe.
 *
 * **A token is single-use and short-lived.** Cloudflare expires it after a
 * few minutes, and the backend rejects a replayed one. `onToken(null)` on
 * expiry/error is therefore not defensive tidiness — it is what stops the
 * form submitting a token the server will refuse, which would read to the
 * user as "creating an organization is broken" rather than "please redo the
 * challenge".
 */

type TurnstileRenderOptions = {
  sitekey: string;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
  theme?: "auto" | "light" | "dark";
  action?: string;
};

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: TurnstileRenderOptions) => string | undefined;
      remove: (widgetId: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptPromise: Promise<void> | null = null;

/** Load Cloudflare's script at most once per document, however many widgets mount. */
function loadTurnstileScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      if (window.turnstile) resolve();
      else {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error("turnstile script failed")));
      }
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => reject(new Error("turnstile script failed")));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function TurnstileWidget({
  siteKey,
  onToken,
  action,
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
  action?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Held in a ref, not state: `onToken` identity changes on every parent
  // render, and re-running the effect would tear down and re-render the
  // widget mid-challenge.
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    let widgetId: string | undefined;
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          callback: (token) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
        });
      })
      .catch(() => {
        // Cloudflare unreachable. Report "no token" and let the backend be
        // the one that refuses — failing closed there is deliberate (see
        // `verify_turnstile_token`), and inventing a client-side bypass here
        // would be exactly the silent hole Part 12 warns against.
        if (!cancelled) onTokenRef.current(null);
      });

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey, action]);

  return <div ref={containerRef} data-testid="turnstile-widget" className="min-h-[65px]" />;
}
