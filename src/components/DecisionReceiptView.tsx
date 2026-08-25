"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ChevronRight,
  CircleAlert,
  RefreshCw,
  SearchX,
  ServerCrash,
} from "lucide-react";
import { getReceipt } from "@/lib/api/receipts";
import { getReview } from "@/lib/api/reviews";
import { pollLeadUntilSettled } from "@/lib/api/polling";
import {
  ArieApiError,
  ArieNotFoundError,
  ArieTimeoutError,
  ArieUnavailableError,
} from "@/lib/api/errors";
import type { LeadStatus, ReceiptResponse, ReviewResponse } from "@/lib/api/types";
import { getRecentLeads, updateRecentLead } from "@/lib/localHistory";
import { formatDateTime, formatUsd, statusLabel } from "@/lib/format";
import { costNoun, costCaveat, isSimulated } from "@/lib/api/providerMode";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { IdChip } from "@/components/ui/CopyButton";
import { Eyebrow, Panel } from "@/components/ui/Panel";
import { ScoreBand } from "@/components/receipt/Gauges";
import { VerdictPanel } from "@/components/receipt/VerdictPanel";
import { StopFlow } from "@/components/receipt/StopFlow";
import { WhoDecided } from "@/components/receipt/WhoDecided";
import { EvidencePanel } from "@/components/receipt/EvidencePanel";
import { HumanReviewPanel } from "@/components/receipt/HumanReviewPanel";
import { ProcessingRail } from "@/components/receipt/ProcessingRail";
import { DURATION, EASE_OUT } from "@/lib/motion";

type LoadState = "loading" | "ready" | "not-found" | "unavailable" | "error";

export function DecisionReceiptView({ leadId }: { leadId: string }) {
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptResponse | null>(null);
  const [review, setReview] = useState<ReviewResponse | null>(null);
  const [liveStatus, setLiveStatus] = useState<LeadStatus | null>(null);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const reduced = useReducedMotion();

  const localLabel = getRecentLeads().find((entry) => entry.lead_id === leadId);

  const refresh = useCallback(async () => {
    setPollTimedOut(false);
    try {
      let current = await getReceipt(leadId);
      setReceipt(current);
      setState("ready");

      if (current.status === "pending") {
        // 90s, not the polling default: arriving here straight from submit is
        // now the normal flow, and the slowest honest path (an escalation that
        // calls every provider, over the hosted backend) legitimately takes
        // most of a minute. The rail shows live status the whole time, and
        // the timeout branch keeps a working "check again".
        try {
          await pollLeadUntilSettled(leadId, { timeoutMs: 90_000, onUpdate: setLiveStatus });
          current = await getReceipt(leadId);
          setReceipt(current);
        } catch (err) {
          if (err instanceof ArieTimeoutError) {
            setPollTimedOut(true);
          } else {
            throw err;
          }
        }
      }

      if (current.status === "decided" && current.score) {
        // Attach the outcome to this browser's local history entry, so the
        // Recent activity card can answer "what happened?" without a
        // per-card receipt fetch. Display-only; live status still wins.
        updateRecentLead(leadId, {
          outcome: statusLabel(current.lead_status),
          confidence: current.score.confidence,
          is_shadow: current.shadow,
        });
      }

      if (current.human_review) {
        const rev = await getReview(current.human_review.review_id);
        setReview(rev);
      } else {
        setReview(null);
      }
    } catch (err) {
      if (err instanceof ArieNotFoundError) {
        setState("not-found");
      } else if (err instanceof ArieUnavailableError) {
        setState("unavailable");
        setErrorMessage(err.message);
      } else if (err instanceof ArieApiError) {
        setState("error");
        setErrorMessage(err.message);
      } else {
        setState("error");
        setErrorMessage("Something went wrong loading this receipt.");
      }
    }
  }, [leadId]);

  useEffect(() => {
    // Resets to "loading" before kicking off the fetch for a *new* leadId --
    // without this, navigating between two receipts would briefly show the
    // previous lead's data under the new URL.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState("loading");
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  if (state === "loading") return <ReceiptSkeleton />;

  if (state === "not-found") {
    return (
      <Failure
        icon={SearchX}
        title="No such lead"
        detail={
          <>
            ARIE has no record of <IdChip value={leadId} />. Check the identifier, or submit a new
            lead to generate one.
          </>
        }
      />
    );
  }

  if (state === "unavailable" || state === "error") {
    return (
      <Failure
        icon={state === "unavailable" ? ServerCrash : CircleAlert}
        title={state === "unavailable" ? "Can't reach ARIE" : "Couldn't load this receipt"}
        detail={errorMessage}
        onRetry={refresh}
      />
    );
  }

  if (!receipt) return null;

  const decided = receipt.status === "decided" && receipt.decision && receipt.score;

  return (
    <div className="flex flex-col gap-5">
      {/* ---------------------------------------------------------- header */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-md text-xs text-text-faint transition-colors hover:text-text-dim"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Overview
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <Eyebrow>Decision receipt</Eyebrow>
            <h1 className="t-h1 mt-1.5 min-w-0 break-words text-text">
              {localLabel?.label ?? (
                <>
                  Lead <span className="t-metric">{leadId.slice(0, 8)}</span>
                </>
              )}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-faint">
              {localLabel?.email && <span className="t-data">{localLabel.email}</span>}
              {localLabel ? (
                <span>submitted from this browser</span>
              ) : (
                // Not in this browser's history — the ID is the only identity
                // available, so it stays up here for that case alone.
                <IdChip value={leadId} />
              )}
            </div>
          </div>
          <StatusPill status={receipt.lead_status} />
        </div>
      </div>

      <AnimatePresence>
        {banner && (
          <motion.div
            initial={reduced ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-2.5 rounded-md border border-human-edge bg-human-dim px-4 py-3 text-sm text-text"
          >
            <CircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-human" />
            {banner}
          </motion.div>
        )}
      </AnimatePresence>

      {receipt.status === "pending" && (
        <ProcessingRail liveStatus={liveStatus} timedOut={pollTimedOut} onRefresh={refresh} />
      )}

      {receipt.status === "processing_failed" && (
        <Panel accent="reject">
          <Eyebrow>Couldn&apos;t evaluate</Eyebrow>
          <h2 className="t-h3 mt-1.5 text-text">ARIE never reached a decision on this lead</h2>
          <p className="mt-2 text-sm leading-relaxed text-text-dim">
            Processing failed permanently, so there is no score, confidence, or stopping reason to
            show — none was ever computed. This lead won&apos;t resolve on its own; submitting it
            again creates a fresh evaluation.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <ButtonLink href="/leads/new" variant="secondary" size="sm">
              Submit it again
            </ButtonLink>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-text-faint transition-colors hover:text-text-dim">
                <ChevronRight
                  aria-hidden
                  className="h-3 w-3 transition-transform duration-200 group-open:rotate-90"
                  strokeWidth={2.25}
                />
                Technical details
              </summary>
              <p className="t-data mt-1.5 text-xs text-text-faint">
                Lead status: {receipt.lead_status} — the processing job exhausted its retries and
                was dead-lettered.
              </p>
            </details>
          </div>
        </Panel>
      )}

      {decided && receipt.decision && receipt.score && receipt.stopping && (
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduced ? { duration: 0 } : { duration: DURATION.slow, ease: EASE_OUT }}
          className="flex flex-col gap-5"
        >
          <VerdictPanel receipt={receipt} />

          <StopFlow receipt={receipt} />

          {/* The chain only exists when a person was actually involved. For a
              purely autonomous decision there is no human stage to draw, and
              inventing one would imply oversight that never happened -- but
              the question still gets answered, by WhoDecided below. */}
          {receipt.human_review && review && !receipt.shadow ? (
            <HumanReviewPanel
              review={review}
              receipt={receipt}
              onDecided={() => {
                setBanner(null);
                refresh();
              }}
              onConflict={(message) => {
                setBanner(message);
                refresh();
              }}
            />
          ) : (
            <WhoDecided receipt={receipt} />
          )}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
            <div className="flex min-w-0 flex-col gap-5">
              <Panel as="section">
                <Eyebrow>Scoring</Eyebrow>
                <h2 className="t-h3 mt-1.5 text-text">Where the score landed</h2>
                <div className="mt-5">
                  <ScoreBand
                    value={receipt.score.value}
                    lower={receipt.score.bounds.lower}
                    upper={receipt.score.bounds.upper}
                    thresholdReject={receipt.score.threshold_reject}
                    thresholdQualify={receipt.score.threshold_qualify}
                  />
                </div>
              </Panel>

              {/* Collapsed by default: the verdict panel's "What it used"
                  line carries the counts; the full ledger is reference
                  material, not part of the first read. */}
              <details className="group/evidence">
                <summary className="surface-flat flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 transition-colors hover:border-border-loud">
                  <span className="min-w-0">
                    <Eyebrow>Evidence</Eyebrow>
                    <span className="mt-1 block text-sm text-text-dim">
                      Every check ARIE made, what each returned, and what each cost
                    </span>
                  </span>
                  <ChevronRight
                    aria-hidden
                    className="h-4 w-4 shrink-0 text-text-faint transition-transform duration-200 group-open/evidence:rotate-90"
                    strokeWidth={2}
                  />
                </summary>
                <div className="mt-4">
                  <EvidencePanel providers={receipt.providers} evidence={receipt.evidence} />
                </div>
              </details>
            </div>

            <aside className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-20 lg:self-start">
              <p className="t-label text-text-faint">Technical details</p>
              <Panel padding="sm">
                <Eyebrow>{costNoun()}</Eyebrow>
                <dl className="mt-3 flex flex-col gap-2 text-sm">
                  <CostRow label="Providers" value={formatUsd(receipt.cost.provider_cost_usd)} />
                  <CostRow label="Model" value={formatUsd(receipt.cost.model_cost_usd)} />
                  <CostRow label="Total" value={formatUsd(receipt.cost.total_cost_usd)} strong />
                  <CostRow
                    label="Budget cap"
                    value={formatUsd(receipt.cost.budget_usd_cap)}
                    muted
                  />
                </dl>
                {isSimulated() && (
                  <p className="mt-3 border-t border-border pt-2.5 text-[0.6875rem] leading-relaxed text-text-faint">
                    {costCaveat()}
                  </p>
                )}
              </Panel>

              <Panel padding="sm">
                <Eyebrow>Provenance</Eyebrow>
                <dl className="mt-3 flex flex-col gap-2 text-sm">
                  <CostRow label="Policy" value={receipt.versions?.policy ?? "—"} mono />
                  <CostRow label="Scorer" value={receipt.versions?.scorer ?? "—"} mono />
                  <CostRow
                    label="Calibration"
                    value={receipt.versions?.confidence_calibration ?? "—"}
                    mono
                  />
                  <CostRow label="Receipt" value={`v${receipt.receipt_version}`} mono muted />
                  {receipt.stopping && (
                    <CostRow label="Stop rule" value={receipt.stopping.reason_code} mono muted />
                  )}
                </dl>
                <div className="mt-3 flex flex-col gap-1 border-t border-border pt-2.5">
                  <span className="text-xs text-text-faint">Lead ID</span>
                  <IdChip value={leadId} truncate />
                </div>
                <p className="mt-3 border-t border-border pt-2.5 text-[0.6875rem] text-text-faint">
                  Decided {formatDateTime(receipt.created_at)}
                </p>
              </Panel>

              {receipt.human_review && (
                <Panel padding="sm">
                  <Eyebrow>Review record</Eyebrow>
                  <div className="mt-3 flex flex-col gap-2 text-sm">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-text-faint">Review ID</span>
                      <IdChip value={receipt.human_review.review_id} truncate />
                    </div>
                    <CostRow
                      label="Reviewer"
                      value={receipt.human_review.reviewer ?? "Unassigned"}
                    />
                    <CostRow
                      label="Responded"
                      value={
                        receipt.human_review.responded_at
                          ? formatDateTime(receipt.human_review.responded_at)
                          : "Pending"
                      }
                    />
                  </div>
                </Panel>
              )}

              <details className="surface-flat group px-4 py-3">
                <summary className="t-label flex cursor-pointer list-none items-center gap-1.5 text-text-faint transition-colors hover:text-text-dim">
                  <ChevronRight
                    aria-hidden
                    className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-90"
                    strokeWidth={2.25}
                  />
                  Developer details
                </summary>
                <p className="mt-2 text-[0.6875rem] leading-relaxed text-text-faint">
                  The exact <code className="t-data">GET /leads/{"{id}"}/receipt</code> response
                  backing this page.
                </p>
                <pre className="scroll-x mt-2 max-h-80 overflow-y-auto rounded-md border border-border bg-bg-sunken p-3 text-[0.6875rem] leading-relaxed text-text-dim">
                  {JSON.stringify(receipt, null, 2)}
                </pre>
              </details>
            </aside>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function CostRow({
  label,
  value,
  strong,
  muted,
  mono,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
  mono?: boolean;
}) {
  return (
    <div
      className={
        strong
          ? "flex items-baseline justify-between gap-3 border-t border-border pt-2"
          : "flex items-baseline justify-between gap-3"
      }
    >
      <dt className="shrink-0 text-xs text-text-faint">{label}</dt>
      <dd
        className={`t-data min-w-0 truncate text-right ${
          muted ? "text-text-faint" : strong ? "text-text" : "text-text-dim"
        } ${mono ? "" : "tabular-nums"}`}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

function Failure({
  icon: Icon,
  title,
  detail,
  onRetry,
}: {
  icon: typeof CircleAlert;
  title: string;
  detail: React.ReactNode;
  onRetry?: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg py-8">
      <Panel padding="lg">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border-strong bg-bg-sunken">
          <Icon aria-hidden className="h-4.5 w-4.5 text-text-dim" strokeWidth={1.75} />
        </span>
        <h1 className="t-h2 mt-4 text-text">{title}</h1>
        <div className="mt-2 text-sm leading-relaxed text-text-dim">{detail}</div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {onRetry && (
            <Button variant="secondary" onClick={onRetry}>
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.25} />
              Try again
            </Button>
          )}
          <ButtonLink href="/" variant="ghost">
            Back to overview
          </ButtonLink>
        </div>
      </Panel>
    </div>
  );
}

/** Mirrors the real receipt's silhouette rather than showing three grey
 * boxes, so the layout doesn't jump when content arrives. */
function ReceiptSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading decision receipt…</span>
      <div className="flex flex-col gap-2.5">
        <span className="skeleton h-3 w-24" />
        <span className="skeleton h-8 w-56" />
        <span className="skeleton h-3 w-72" />
      </div>
      <div className="surface-flat p-6 sm:p-8">
        <span className="skeleton block h-3 w-32" />
        <span className="skeleton mt-3 block h-8 w-52" />
        <span className="skeleton mt-4 block h-3 w-full max-w-lg" />
        <div className="mt-8 grid grid-cols-2 gap-5 border-t border-border pt-6 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <span className="skeleton block h-2.5 w-16" />
              <span className="skeleton mt-2.5 block h-7 w-20" />
            </div>
          ))}
        </div>
        <span className="skeleton mt-8 block h-2 w-full rounded-full" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="flex flex-col gap-5">
          <div className="surface-flat h-44 p-6" />
          <div className="surface-flat h-72 p-6" />
        </div>
        <div className="flex flex-col gap-5">
          <div className="surface-flat h-40 p-4" />
          <div className="surface-flat h-40 p-4" />
        </div>
      </div>
    </div>
  );
}
