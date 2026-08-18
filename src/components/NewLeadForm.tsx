"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { submitLead } from "@/lib/api/leads";
import { pollLeadUntilSettled } from "@/lib/api/polling";
import { addRecentLead } from "@/lib/localHistory";
import { ArieApiError, ArieTimeoutError, ArieValidationError } from "@/lib/api/errors";
import type { LeadStatus } from "@/lib/api/types";
import { PROCESSING_SEQUENCE, statusLabel } from "@/lib/format";
import { Panel, Eyebrow } from "./ui/Panel";

type FlowState = "idle" | "submitting" | "processing" | "error";

interface Preset {
  label: string;
  email: string;
  full_name: string;
  company_domain: string;
  company_name: string;
}

const DEMO_PRESETS: Preset[] = [
  {
    label: "Nadia Delacroix — autonomous",
    email: "nadia.delacroix@lumen500.com",
    full_name: "Nadia Delacroix",
    company_domain: "lumen500.com",
    company_name: "",
  },
  {
    label: "Nadia Haddad — human escalation",
    email: "nadia.haddad@cobalt500.com",
    full_name: "Nadia Haddad",
    company_domain: "cobalt500.com",
    company_name: "Cobalt500 Ltd",
  },
];

function freshExternalRef(): string {
  return `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function NewLeadForm() {
  const router = useRouter();

  const [source, setSource] = useState("arie-web");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyDomain, setCompanyDomain] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [externalRef, setExternalRef] = useState(freshExternalRef);

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

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setError(null);
      setState("submitting");

      try {
        const result = await submitLead({
          source,
          email,
          full_name: fullName || null,
          company_domain: companyDomain || null,
          company_name: companyName || null,
          external_ref: externalRef || null,
        });
        setSubmittedLeadId(result.lead_id);
        setState("processing");
        setCurrentStatus(result.status);

        await pollLeadUntilSettled(result.lead_id, { onUpdate: setCurrentStatus });

        addRecentLead({
          lead_id: result.lead_id,
          label: fullName || email,
          email,
          submitted_at: new Date().toISOString(),
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
    [source, email, fullName, companyDomain, companyName, externalRef, router],
  );

  const isBusy = state === "submitting" || state === "processing";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Panel>
        <Eyebrow>New lead</Eyebrow>
        <h1 className="mt-2 font-display text-2xl font-medium text-text">Submit a lead to ARIE</h1>
        <p className="mt-2 text-sm text-text-dim">
          This is the actual <code className="font-data text-xs">POST /leads</code> request body —
          nothing here is simulated once submitted in API mode.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Source" required>
              <input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                required
                disabled={isBusy}
                className="input"
              />
            </Field>
            <Field label="Email" required>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isBusy}
                placeholder="nadia.delacroix@lumen500.com"
                className="input"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isBusy}
                className="input"
              />
            </Field>
            <Field label="Company domain">
              <input
                value={companyDomain}
                onChange={(e) => setCompanyDomain(e.target.value)}
                disabled={isBusy}
                placeholder="lumen500.com"
                className="input"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company name">
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={isBusy}
                className="input"
              />
            </Field>
            <Field label="External ref" hint="Keeps redelivery idempotent">
              <input
                value={externalRef}
                onChange={(e) => setExternalRef(e.target.value)}
                disabled={isBusy}
                className="input font-data text-xs"
              />
            </Field>
          </div>

          <div className="mt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={isBusy}
              className="rounded-lg bg-machine px-5 py-2.5 text-sm font-semibold text-bg transition-transform hover:scale-[1.02] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100"
            >
              {isBusy ? "Processing…" : "Submit lead"}
            </button>
            {state === "error" && (
              <button
                type="button"
                onClick={() => {
                  setState("idle");
                  setError(null);
                }}
                className="text-sm text-text-dim underline underline-offset-4 hover:text-text"
              >
                Edit and try again
              </button>
            )}
          </div>
        </form>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 rounded-lg border border-reject/40 bg-reject-dim px-4 py-3 text-sm text-text"
            >
              <p>{error}</p>
              {submittedLeadId && (
                <p className="mt-2">
                  <a
                    href={`/leads/${submittedLeadId}`}
                    className="text-machine underline underline-offset-4"
                  >
                    View its receipt anyway
                  </a>{" "}
                  — it may still be processing.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </Panel>

      <div className="flex flex-col gap-6">
        <Panel>
          <Eyebrow>Try a deterministic identity</Eyebrow>
          <div className="mt-3 flex flex-col gap-2">
            {DEMO_PRESETS.map((preset) => (
              <button
                key={preset.email}
                type="button"
                disabled={isBusy}
                onClick={() => applyPreset(preset)}
                className="rounded-lg border border-border px-3 py-2 text-left text-sm text-text-dim transition-colors hover:border-border-strong hover:text-text disabled:opacity-50"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-text-faint">
            Fills the form from the frozen demo corpus. Each use generates a fresh external
            reference so it always creates a new run.
          </p>
        </Panel>

        <AnimatePresence>{isBusy && <ProcessingPanel status={currentStatus} />}</AnimatePresence>
      </div>
    </div>
  );
}

function ProcessingPanel({ status }: { status: LeadStatus | null }) {
  const currentIndex = status ? PROCESSING_SEQUENCE.indexOf(status) : -1;
  const isBranched = status !== null && currentIndex === -1;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <Panel accent="machine">
        <Eyebrow>Live status</Eyebrow>
        <ol className="mt-3 flex flex-col gap-2.5">
          {PROCESSING_SEQUENCE.map((stage, index) => {
            const done = currentIndex > index || isBranched;
            const active = currentIndex === index;
            return (
              <li key={stage} className="flex items-center gap-2.5 text-sm">
                <span
                  className={
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[0.65rem] " +
                    (done
                      ? "border-machine bg-machine text-bg"
                      : active
                        ? "border-machine text-machine"
                        : "border-border-strong text-text-faint")
                  }
                >
                  {done ? "✓" : index + 1}
                </span>
                <span className={done || active ? "text-text" : "text-text-faint"}>
                  {statusLabel(stage)}
                </span>
                {active && (
                  <span className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-machine" />
                )}
              </li>
            );
          })}
        </ol>
        {isBranched && status && (
          <p className="mt-4 rounded-lg bg-panel-2 px-3 py-2 text-sm text-text">
            {statusLabel(status)} — redirecting to the receipt…
          </p>
        )}
      </Panel>
    </motion.div>
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
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-text-dim">
        {label}
        {required && <span className="text-human"> *</span>}
      </span>
      {children}
      {hint && <span className="text-[0.7rem] text-text-faint">{hint}</span>}
    </label>
  );
}
