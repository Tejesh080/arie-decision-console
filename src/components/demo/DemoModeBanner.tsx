import { FlaskConical } from "lucide-react";

/**
 * The persistent "this is not real" label `/demo` is required to carry —
 * not a tooltip, not a one-time toast, but a fixture at the top of the page
 * that scrolls with the reader. `/demo` never calls a backend and never
 * requires a session (see `src/app/demo/page.tsx` and `middleware.ts`'s
 * `onDemoPage` exemption), but the receipt components it reuses (
 * `VerdictPanel`, `EvidencePanel`, ...) don't know that — they render
 * whatever `providerMode.ts`'s site-wide `NEXT_PUBLIC_ARIE_PROVIDER_MODE`
 * says. This banner is the one place on the page that is unconditionally
 * true regardless of that configuration.
 */
export function DemoModeBanner() {
  return (
    <div className="sticky top-0 z-50 border-b border-shadow-edge/60 bg-shadow-dim/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 sm:px-8">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.06em] text-shadow-role uppercase">
          <FlaskConical aria-hidden className="h-3.5 w-3.5" strokeWidth={2.25} />
          Demo mode · Simulated providers · Modelled cost
        </span>
        <span className="text-[0.75rem] leading-snug text-text-dim">
          Every number below is frozen sample data. No provider was called, no lead was created,
          and nothing here was ever billed — regardless of how this site is configured elsewhere.
        </span>
      </div>
    </div>
  );
}
