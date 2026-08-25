"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, ChevronRight, CircleAlert, Eye, RefreshCw } from "lucide-react";
import clsx from "clsx";
import { submitLead } from "@/lib/api/leads";
import { addRecentLead } from "@/lib/localHistory";
import { ArieApiError, ArieUnavailableError, ArieValidationError } from "@/lib/api/errors";
import type { IngestLeadRequest } from "@/lib/api/types";
import { DEMO_EXAMPLES, findExample, freshExternalRef } from "@/lib/demoExamples";
import { Panel, Eyebrow } from "./ui/Panel";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";

type FlowState = "idle" | "submitting" | "error";

/**
 * The public site is the source; visitors never name it. Developers wiring a
 * different delivery channel set their own source over the API — see the
 * backend's docs — which is exactly where that concern belongs.
 */
const WEB_SOURCE = "arie-web";

/**
 * `www.acme.com/pricing`, `https://acme.com`, and `ACME.COM ` are all the
 * same company to a person pasting from a browser bar. The backend
 * normalizes identically (`arie.identity.normalize.normalize_domain`); doing
 * it here too just means the form never sends a value the receipt would
 * disagree with.
 */
function normalizeDomainInput(raw: string): string {
  let value = raw.trim().toLowerCase();
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  value = value.split("/", 1)[0].split("?", 1)[0].split(":", 1)[0];
  if (value.startsWith("www.")) value = value.slice(4);
  return value;
}

export function NewLeadForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduced = useReducedMotion();

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyDomain, setCompanyDomain] = useState("");
  const [shadowMode, setShadowMode] = useState(false);

  const [state, setState] = useState<FlowState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [runningExample, setRunningExample] = useState<string | null>(null);

  /**
   * One delivery reference per *logical* submission, generated here, never
   * typed. Stable across retries of the same payload — so "Try again" after
   * a failure lands on ARIE's (source, external_ref) idempotency and cannot
   * create a duplicate lead — and regenerated the moment the payload changes
   * or a submission succeeds, so a genuinely new submission is a new lead.
   */
  const refHolder = useRef<{ key: string; ref: string } | null>(null);
  const externalRefFor = (payload: IngestLeadRequest): string => {
    const key = JSON.stringify([
      payload.email,
      payload.full_name,
      payload.company_domain,
      payload.company_name,
      payload.mode,
    ]);
    if (refHolder.current?.key !== key) {
      refHolder.current = { key, ref: freshExternalRef() };
    }
    return refHolder.current.ref;
  };

  const run = useCallback(
    async (payload: IngestLeadRequest, label: string) => {
      setError(null);
      setErrorDetail(null);
      setState("submitting");

      try {
        const result = await submitLead(payload);
        refHolder.current = null; // the next submission is a new lead
        // Remembered before navigating, so a refresh mid-processing finds
        // its way back through Recent activity rather than stranding.
        addRecentLead({
          lead_id: result.lead_id,
          label,
          email: payload.email,
          company: payload.company_name ?? payload.company_domain ?? undefined,
          submitted_at: new Date().toISOString(),
          is_shadow: result.is_shadow,
        });
        // The receipt page owns the watching-it-process experience: it polls
        // live status, survives refresh, and its URL is shareable from the
        // first second.
        router.push(`/leads/${result.lead_id}`);
      } catch (err) {
        setState("error");
        setRunningExample(null);
        if (err instanceof ArieValidationError) {
          setError(`ARIE couldn't accept this lead: ${err.message}`);
        } else if (err instanceof ArieUnavailableError) {
          setError("ARIE's backend didn't respond. Nothing was lost — try again in a moment.");
          setErrorDetail(err.message);
        } else if (err instanceof ArieApiError) {
          setError(
            "We couldn't evaluate this lead. Retrying is safe — the same submission won't be double-counted.",
          );
          setErrorDetail(`HTTP ${err.status}: ${err.message}`);
        } else {
          setError("Something went wrong submitting this lead. Retrying is safe.");
          setErrorDetail(err instanceof Error ? err.message : String(err));
        }
      }
    },
    [router],
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const domain = normalizeDomainInput(companyDomain);
      const base: IngestLeadRequest = {
        source: WEB_SOURCE,
        email: email.trim(),
        full_name: fullName.trim() || null,
        company_domain: domain || null,
        company_name: companyName.trim() || null,
        mode: shadowMode ? "shadow" : "normal",
      };
      void run({ ...base, external_ref: externalRefFor(base) }, fullName.trim() || email.trim());
    },
    [run, email, fullName, companyDomain, companyName, shadowMode],
  );

  const runExample = useCallback(
    (id: string) => {
      const example = findExample(id);
      if (!example) return;
      setRunningExample(id);
      // The fields are populated as well as submitted, so if the run fails
      // the form the visitor falls back to is already filled in.
      setEmail(example.lead.email);
      setFullName(example.lead.full_name ?? "");
      setCompanyDomain(example.lead.company_domain ?? "");
      setCompanyName(example.lead.company_name ?? "");
      setShadowMode(example.lead.mode === "shadow");
      void run(
        { ...example.lead, external_ref: freshExternalRef() },
        example.lead.full_name ?? example.lead.email,
      );
    },
    [run],
  );

  // `?run=<example>` fires one of the prepared examples on arrival — what
  // makes the homepage cards one click. Guarded by a ref, not state, so
  // React's development double-invoke cannot submit the same lead twice.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current) return;
    const id = searchParams.get("run");
    if (!findExample(id)) return;
    autoRan.current = true;
    // Syncing form state from the URL, which is the external system here —
    // same sanctioned pattern (and same rationale) as the previous version
    // of this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    runExample(id!);
  }, [searchParams, runExample]);

  const isBusy = state === "submitting";

  return (
    <div>
      <header className="mb-8 max-w-2xl">
        <Eyebrow>New lead</Eyebrow>
        <h1 className="t-h1 mt-2 text-text">Evaluate a lead</h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-text-dim">
          ARIE gathers enrichment evidence until it has enough to make a confident recommendation —
          then routes the lead, asks a human, or stops. Because this is the public demo, provider
          data is simulated and costs are modelled; any identity you enter gets deterministic
          simulated evidence of its own.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* ------------------------------------------------------------ form */}
        <motion.div
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <Panel padding="lg" as="section">
            <form onSubmit={handleSubmit} className="grid gap-5">
              <fieldset className="grid gap-4" disabled={isBusy}>
                <legend className="sr-only">Lead details</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Email" required>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="jordan.reeves@acme.com"
                      className="input"
                    />
                  </Field>
                  <Field label="Full name">
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jordan Reeves"
                      className="input"
                    />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Company">
                    <input
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Acme Corp"
                      className="input"
                    />
                  </Field>
                  <Field label="Company domain" hint="Helps ARIE look the company up">
                    <input
                      value={companyDomain}
                      onChange={(e) => setCompanyDomain(e.target.value)}
                      placeholder="acme.com"
                      className="input"
                    />
                  </Field>
                </div>
              </fieldset>

              <ShadowToggle checked={shadowMode} onChange={setShadowMode} disabled={isBusy} />

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={reduced ? false : { opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-md border border-reject-edge bg-reject-dim px-4 py-3 text-sm text-text"
                  >
                    <p className="flex items-start gap-2">
                      <CircleAlert
                        aria-hidden
                        className="mt-0.5 h-4 w-4 shrink-0 text-reject"
                        strokeWidth={2.25}
                      />
                      {error}
                    </p>
                    {errorDetail && (
                      <details className="mt-2 pl-6">
                        <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-text-faint transition-colors hover:text-text-dim">
                          <ChevronRight aria-hidden className="h-3 w-3" strokeWidth={2.25} />
                          Technical details
                        </summary>
                        <p className="t-data mt-1.5 text-xs break-all text-text-faint">
                          {errorDetail}
                        </p>
                      </details>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
                <Button
                  type="submit"
                  variant={shadowMode ? "secondary" : "primary"}
                  size="lg"
                  disabled={isBusy}
                >
                  {isBusy ? (
                    "Submitting…"
                  ) : state === "error" ? (
                    <>
                      <RefreshCw className="h-4 w-4" strokeWidth={2.25} />
                      Try again
                    </>
                  ) : (
                    <>
                      {shadowMode ? "Evaluate in shadow" : "Evaluate lead"}
                      <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
                    </>
                  )}
                </Button>
                {!isBusy && state !== "error" && (
                  <span className="text-xs text-text-faint">
                    Takes 5–30 seconds — you&apos;ll watch it happen.
                  </span>
                )}
              </div>
            </form>
          </Panel>
        </motion.div>

        {/* -------------------------------------------------------- examples */}
        <aside className="flex flex-col gap-5">
          <Panel padding="sm">
            <Eyebrow>Try an example</Eyebrow>
            <div className="mt-3 flex flex-col gap-2">
              {DEMO_EXAMPLES.map((example) => (
                <button
                  key={example.id}
                  type="button"
                  disabled={isBusy}
                  onClick={() => runExample(example.id)}
                  className="group rounded-md border border-border bg-bg-sunken p-3 text-left transition-[border-color,background-color] duration-[130ms] hover:border-border-loud hover:bg-surface-2 disabled:opacity-50"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-text">{example.outcome}</span>
                    {isBusy && runningExample === example.id ? (
                      <span className="breathe h-1.5 w-1.5 shrink-0 rounded-full bg-machine" />
                    ) : (
                      <ArrowRight
                        aria-hidden
                        className="h-3.5 w-3.5 shrink-0 text-text-faint opacity-0 transition-opacity group-hover:opacity-100"
                        strokeWidth={2}
                      />
                    )}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-text-dim">
                    {example.headline}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-[0.6875rem] leading-relaxed text-text-faint">
              Each example replays the same simulated evidence every run, so it reliably shows its
              outcome — that predictability is why the button can honestly name the ending.
            </p>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

/** A switch, not a checkbox — shadow mode changes what submitting *means*,
 * so it deserves a control with weight and an explanation attached. */
function ShadowToggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={clsx(
        "rounded-md border p-4 transition-colors duration-200",
        checked ? "border-shadow-edge bg-shadow-dim/40" : "border-border bg-bg-sunken",
      )}
    >
      <label className="flex cursor-pointer items-start gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={clsx(
            "relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors duration-200",
            checked ? "border-shadow-edge bg-shadow-role/30" : "border-border-strong bg-surface-2",
          )}
        >
          <span className="sr-only">Shadow evaluation</span>
          <motion.span
            layout
            transition={{ type: "spring", stiffness: 520, damping: 34 }}
            className={clsx(
              "absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full",
              checked ? "left-[1.125rem] bg-shadow-role" : "left-0.5 bg-text-faint",
            )}
          />
        </button>
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="text-sm font-medium text-text">Shadow evaluation</span>
            {checked && (
              <Badge tone="shadow" variant="outline" size="sm">
                <Eye aria-hidden className="h-3 w-3" strokeWidth={2.25} />
                Observational
              </Badge>
            )}
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-text-faint">
            ARIE makes its full recommendation but doesn&apos;t act on it — nothing is routed,
            nothing is rejected, and nobody is asked to review. The receipt shows what it{" "}
            <em>would</em> have done.
          </span>
        </span>
      </label>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-medium text-text-dim">
        {label}
        {required && (
          <span className="text-human" aria-hidden>
            {" "}
            *
          </span>
        )}
        {required && <span className="sr-only"> (required)</span>}
      </span>
      {children}
      {hint && <span className="text-[0.6875rem] text-text-faint">{hint}</span>}
    </label>
  );
}
