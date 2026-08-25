"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, CircleAlert, Eye, Sparkle } from "lucide-react";
import clsx from "clsx";
import { submitLead } from "@/lib/api/leads";
import { pollLeadUntilSettled } from "@/lib/api/polling";
import { addRecentLead } from "@/lib/localHistory";
import { ArieApiError, ArieTimeoutError, ArieValidationError } from "@/lib/api/errors";
import type { IngestLeadRequest, LeadStatus } from "@/lib/api/types";
import { findExample, freshExternalRef } from "@/lib/demoExamples";
import { Panel, Eyebrow } from "./ui/Panel";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { IdChip } from "./ui/CopyButton";
import { ProcessingRail } from "./receipt/ProcessingRail";
import { DURATION, EASE_OUT } from "@/lib/motion";

type FlowState = "idle" | "submitting" | "processing" | "error";

interface Preset {
  label: string;
  outcome: string;
  email: string;
  full_name: string;
  company_domain: string;
  company_name: string;
}

/**
 * Identities from the frozen evaluation corpus. Under
 * `PROVIDER_MODE=simulated` the corpus is replayed rather than sampled, so
 * these resolve the same way every time — which is what makes it honest to
 * name the outcome on the button.
 */
const DEMO_PRESETS: Preset[] = [
  {
    label: "Nadia Delacroix",
    outcome: "Resolves autonomously",
    email: "nadia.delacroix@lumen500.com",
    full_name: "Nadia Delacroix",
    company_domain: "lumen500.com",
    company_name: "",
  },
  {
    label: "Nadia Haddad",
    outcome: "Escalates to human review",
    email: "nadia.haddad@cobalt500.com",
    full_name: "Nadia Haddad",
    company_domain: "cobalt500.com",
    company_name: "Cobalt500 Ltd",
  },
];

export function NewLeadForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduced = useReducedMotion();

  const [source, setSource] = useState("arie-web");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyDomain, setCompanyDomain] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [externalRef, setExternalRef] = useState(freshExternalRef);
  const [shadowMode, setShadowMode] = useState(false);

  const [state, setState] = useState<FlowState>("idle");
  const [currentStatus, setCurrentStatus] = useState<LeadStatus | null>(null);
  const [submittedLeadId, setSubmittedLeadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyPreset = (preset: Preset) => {
    setEmail(preset.email);
    setFullName(preset.full_name);
    setCompanyDomain(preset.company_domain);
    setCompanyName(preset.company_name);
    setExternalRef(freshExternalRef());
  };

  const run = useCallback(
    async (payload: IngestLeadRequest, label: string) => {
      setError(null);
      setState("submitting");

      try {
        const result = await submitLead(payload);
        setSubmittedLeadId(result.lead_id);
        setState("processing");
        setCurrentStatus(result.status);

        // 60s rather than the 30s default. The escalation path calls every
        // provider in the catalogue, several of which are deliberately slow,
        // and each poll is a proxy round trip to a hosted backend -- against
        // Railway that legitimately exceeds 30s, which would surface a
        // timeout for a lead that is processing perfectly normally. The rail
        // shows real progress throughout, so the wait is never blank, and
        // the timeout branch still hands over the receipt link.
        await pollLeadUntilSettled(result.lead_id, {
          onUpdate: setCurrentStatus,
          timeoutMs: 60_000,
        });

        addRecentLead({
          lead_id: result.lead_id,
          label,
          email: payload.email,
          submitted_at: new Date().toISOString(),
          is_shadow: result.is_shadow,
        });
        router.push(`/leads/${result.lead_id}`);
      } catch (err) {
        setState("error");
        if (err instanceof ArieTimeoutError) {
          setError(err.message);
        } else if (err instanceof ArieValidationError) {
          setError(`ARIE rejected this lead: ${err.message}`);
        } else if (err instanceof ArieApiError) {
          setError(err.message);
        } else {
          setError("Something went wrong submitting this lead.");
        }
      }
    },
    [router],
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      void run(
        {
          source,
          email,
          full_name: fullName || null,
          company_domain: companyDomain || null,
          company_name: companyName || null,
          external_ref: externalRef || null,
          mode: shadowMode ? "shadow" : "normal",
        },
        fullName || email,
      );
    },
    [run, source, email, fullName, companyDomain, companyName, externalRef, shadowMode],
  );

  // `?run=<example>` fires one of the prepared examples on arrival, which is
  // what makes the homepage cards one click rather than "fill this form in".
  // Guarded by a ref, not by state, so React's development double-invoke
  // cannot submit the same lead twice.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current) return;
    const example = findExample(searchParams.get("run"));
    if (!example) return;
    autoRan.current = true;

    // Syncing form state from the URL, which is the external system here. The
    // fields are populated as well as submitted so that if the run fails, the
    // form the user falls back to is already filled in rather than empty.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEmail(example.lead.email);
    setFullName(example.lead.full_name ?? "");
    setCompanyDomain(example.lead.company_domain ?? "");
    setCompanyName(example.lead.company_name ?? "");
    setShadowMode(example.lead.mode === "shadow");
    void run(
      { ...example.lead, external_ref: freshExternalRef() },
      example.lead.full_name ?? example.lead.email,
    );
  }, [searchParams, run]);

  const isBusy = state === "submitting" || state === "processing";

  return (
    <div>
      <header className="mb-8 max-w-2xl">
        <Eyebrow>New lead</Eyebrow>
        <h1 className="t-h1 mt-2 text-text">Submit a lead to ARIE</h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-text-dim">
          These fields are the real <code className="t-data text-text-dim">POST /leads</code>{" "}
          request body. Once submitted, ARIE runs its actual acquisition and scoring pipeline — the
          progress below reflects genuine state transitions, not a scripted animation.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* ------------------------------------------------------------ form */}
        <AnimatePresence mode="wait" initial={false}>
          {isBusy ? (
            <motion.div
              key="processing"
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: DURATION.slow, ease: EASE_OUT }}
            >
              <Panel accent={shadowMode ? "shadow" : "machine"} padding="lg">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Eyebrow>{shadowMode ? "Shadow evaluation" : "In flight"}</Eyebrow>
                    <h2 className="t-h2 mt-2 text-text">{fullName || email}</h2>
                    {submittedLeadId ? (
                      <div className="mt-2">
                        <IdChip value={submittedLeadId} />
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-text-faint">Accepting…</p>
                    )}
                  </div>
                  {shadowMode && (
                    <Badge tone="shadow" variant="outline">
                      No routing action
                    </Badge>
                  )}
                </div>

                <div className="mt-7 border-t border-border pt-6">
                  <ProcessingRail liveStatus={currentStatus} compact />
                </div>

                <p className="mt-5 text-[0.8125rem] leading-relaxed text-text-faint">
                  You&apos;ll land on the decision receipt as soon as ARIE settles. Nothing is lost
                  if you navigate away — the receipt is addressable by lead ID.
                </p>
              </Panel>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduced ? undefined : { opacity: 0 }}
              transition={{ duration: DURATION.base }}
            >
              <Panel padding="lg" as="section">
                <form onSubmit={handleSubmit} className="grid gap-5">
                  <fieldset className="grid gap-4">
                    <legend className="sr-only">Lead identity</legend>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Email" required hint="The only field ARIE strictly requires">
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          placeholder="nadia.delacroix@lumen500.com"
                          className="input"
                        />
                      </Field>
                      <Field label="Full name">
                        <input
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Nadia Delacroix"
                          className="input"
                        />
                      </Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Company domain" hint="Drives firmographic lookups">
                        <input
                          value={companyDomain}
                          onChange={(e) => setCompanyDomain(e.target.value)}
                          placeholder="lumen500.com"
                          className="input"
                        />
                      </Field>
                      <Field label="Company name">
                        <input
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          className="input"
                        />
                      </Field>
                    </div>
                  </fieldset>

                  <fieldset className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
                    <legend className="sr-only">Delivery metadata</legend>
                    <Field label="Source" required>
                      <input
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                        required
                        className="input"
                      />
                    </Field>
                    <Field label="External ref" hint="Keeps redelivery idempotent">
                      <input
                        value={externalRef}
                        onChange={(e) => setExternalRef(e.target.value)}
                        className="input t-data"
                      />
                    </Field>
                  </fieldset>

                  <ShadowToggle checked={shadowMode} onChange={setShadowMode} />

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
                        {submittedLeadId && (
                          <p className="mt-2 pl-6 text-text-dim">
                            ARIE accepted the lead before this failed —{" "}
                            <a
                              href={`/leads/${submittedLeadId}`}
                              className="text-machine underline underline-offset-4"
                            >
                              open its receipt
                            </a>
                            ; it may still be processing.
                          </p>
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
                      {shadowMode ? "Evaluate in shadow" : "Submit lead"}
                      <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
                    </Button>
                    {state === "error" && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setState("idle");
                          setError(null);
                        }}
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                </form>
              </Panel>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --------------------------------------------------------- presets */}
        <aside className="flex flex-col gap-5">
          <Panel padding="sm">
            <Eyebrow>Deterministic identities</Eyebrow>
            <div className="mt-3 flex flex-col gap-2">
              {DEMO_PRESETS.map((preset) => (
                <button
                  key={preset.email}
                  type="button"
                  disabled={isBusy}
                  onClick={() => applyPreset(preset)}
                  className="group rounded-md border border-border bg-bg-sunken p-3 text-left transition-[border-color,background-color] duration-[130ms] hover:border-border-loud hover:bg-surface-2 disabled:opacity-50"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-text">{preset.label}</span>
                    <Sparkle
                      aria-hidden
                      className="h-3.5 w-3.5 shrink-0 text-text-faint opacity-0 transition-opacity group-hover:opacity-100"
                      strokeWidth={2}
                    />
                  </span>
                  <span className="t-data mt-1 block truncate text-text-faint">{preset.email}</span>
                  <span className="mt-2 block text-xs text-text-dim">{preset.outcome}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-[0.6875rem] leading-relaxed text-text-faint">
              Fills the form from the frozen evaluation corpus, which replays identically every run.
              Each click generates a fresh external reference, so it always creates a new lead
              rather than returning the previous one.
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
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
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
          onClick={() => onChange(!checked)}
          className={clsx(
            "relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors duration-200",
            checked ? "border-shadow-edge bg-shadow-role/30" : "border-border-strong bg-surface-2",
          )}
        >
          <span className="sr-only">Shadow mode</span>
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
            <span className="text-sm font-medium text-text">Shadow mode</span>
            {checked && (
              <Badge tone="shadow" variant="outline" size="sm">
                <Eye aria-hidden className="h-3 w-3" strokeWidth={2.25} />
                Observational
              </Badge>
            )}
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-text-faint">
            ARIE computes its full recommendation, score and confidence, but takes no authoritative
            action — nothing is routed, nothing is rejected, and no human review is opened. The
            receipt records what it <em>would</em> have done.
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
