"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
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
import { getRecentLeads } from "@/lib/localHistory";
import { formatDateTime, formatUsd, statusLabel, PROCESSING_SEQUENCE } from "@/lib/format";
import { decisionLabel, toneForStatus } from "@/lib/format/decision";
import { Badge } from "@/components/ui/Badge";
import { Eyebrow, Panel } from "@/components/ui/Panel";
import { ConfidenceGauge, ScoreGauge } from "@/components/receipt/Gauges";
import { EvidencePanel } from "@/components/receipt/EvidencePanel";
import { HumanReviewPanel } from "@/components/receipt/HumanReviewPanel";

type LoadState = "loading" | "ready" | "not-found" | "unavailable" | "error";

export function DecisionReceiptView({ leadId }: { leadId: string }) {
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptResponse | null>(null);
  const [review, setReview] = useState<ReviewResponse | null>(null);
  const [liveStatus, setLiveStatus] = useState<LeadStatus | null>(null);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const localLabel = getRecentLeads().find((entry) => entry.lead_id === leadId);

  const refresh = useCallback(async () => {
    setPollTimedOut(false);
    try {
      let current = await getReceipt(leadId);
      setReceipt(current);
      setState("ready");

      if (current.status === "pending") {
        try {
          await pollLeadUntilSettled(leadId, { timeoutMs: 20_000, onUpdate: setLiveStatus });
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
    // Resets to "loading" before kicking off the fetch for a *new* leadId —
    // without this, navigating between two receipts would briefly show the
    // previous lead's data under the new URL.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState("loading");
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  if (state === "loading") {
    return <LoadingSkeleton />;
  }

  if (state === "not-found") {
    return (
      <StatusPanel tone="reject" title="Lead not found">
        <p>
          No lead exists with id <code className="font-data text-xs">{leadId}</code>.
        </p>
        <Link href="/" className="mt-3 inline-block text-machine underline underline-offset-4">
          ← Back to dashboard
        </Link>
      </StatusPanel>
    );
  }

  if (state === "unavailable") {
    return (
      <StatusPanel tone="reject" title="ARIE backend unavailable">
        <p>{errorMessage}</p>
        <button
          onClick={refresh}
          className="mt-3 rounded-lg border border-border-strong px-4 py-2 text-sm text-text hover:border-machine hover:text-machine"
        >
          Retry
        </button>
      </StatusPanel>
    );
  }

  if (state === "error") {
    return (
      <StatusPanel tone="reject" title="Couldn't load this receipt">
        <p>{errorMessage}</p>
        <button
          onClick={refresh}
          className="mt-3 rounded-lg border border-border-strong px-4 py-2 text-sm text-text hover:border-machine hover:text-machine"
        >
          Retry
        </button>
      </StatusPanel>
    );
  }

  if (!receipt) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/" className="text-xs text-text-faint hover:text-text-dim">
          ← Dashboard
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-medium text-text">
              {localLabel?.label ?? "Lead"}
              {localLabel && (
                <span className="ml-2 text-sm font-normal text-text-faint">
                  (as submitted from this browser)
                </span>
              )}
            </h1>
            <p className="mt-1 font-data text-xs text-text-faint">{leadId}</p>
          </div>
          <Badge tone={toneForStatus(receipt.lead_status)}>
            {statusLabel(receipt.lead_status)}
          </Badge>
        </div>
      </div>

      {banner && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-lg border border-human/40 bg-human-dim px-4 py-3 text-sm text-text"
        >
          {banner}
        </motion.div>
      )}

      {receipt.status === "pending" && (
        <PendingPanel liveStatus={liveStatus} timedOut={pollTimedOut} onRefresh={refresh} />
      )}

      {receipt.status === "processing_failed" && (
        <StatusPanel tone="reject" title="Processing failed">
          <p>
            This lead was dead-lettered before ARIE reached a decision — it will not resolve on its
            own. Current status: <strong>{statusLabel(receipt.lead_status)}</strong>.
          </p>
        </StatusPanel>
      )}

      {receipt.status === "decided" && receipt.decision && receipt.score && receipt.stopping && (
        <>
          {receipt.human_review && review ? (
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
            <Panel accent="machine">
              <Eyebrow>Machine recommendation</Eyebrow>
              <p className="mt-1 font-display text-2xl font-medium text-machine">
                {decisionLabel(receipt.decision.recommended_action)}
              </p>
              <p className="mt-1 text-sm text-text-dim">
                Acted autonomously — no human review required.
              </p>
            </Panel>
          )}

          <Panel>
            <Eyebrow>Score &amp; confidence</Eyebrow>
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              <ScoreGauge
                value={receipt.score.value}
                lower={receipt.score.bounds.lower}
                upper={receipt.score.bounds.upper}
                thresholdReject={receipt.score.threshold_reject}
                thresholdQualify={receipt.score.threshold_qualify}
              />
              <ConfidenceGauge confidence={receipt.score.confidence} tau={receipt.score.tau} />
            </div>
            <div className="mt-5 rounded-lg bg-panel-2 px-4 py-3 text-sm text-text-dim">
              <span className="font-medium text-text">
                Why processing stopped ({receipt.stopping.reason_code}):
              </span>{" "}
              {receipt.stopping.explanation}
            </div>
          </Panel>

          <EvidencePanel providers={receipt.providers} evidence={receipt.evidence} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Panel>
              <Eyebrow>Cost</Eyebrow>
              <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-text-faint">Provider spend</dt>
                <dd className="text-right font-data tabular-nums text-text">
                  {formatUsd(receipt.cost.provider_cost_usd)}
                </dd>
                <dt className="text-text-faint">Model spend</dt>
                <dd className="text-right font-data tabular-nums text-text">
                  {formatUsd(receipt.cost.model_cost_usd)}
                </dd>
                <dt className="text-text-faint">Total</dt>
                <dd className="text-right font-data tabular-nums text-text">
                  {formatUsd(receipt.cost.total_cost_usd)}
                </dd>
                <dt className="text-text-faint">Budget cap</dt>
                <dd className="text-right font-data tabular-nums text-text-dim">
                  {formatUsd(receipt.cost.budget_usd_cap)}
                </dd>
              </dl>
            </Panel>
            <Panel>
              <Eyebrow>Provenance</Eyebrow>
              <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-text-faint">Policy</dt>
                <dd className="text-right font-data text-xs text-text">
                  {receipt.versions?.policy ?? "—"}
                </dd>
                <dt className="text-text-faint">Scorer</dt>
                <dd className="text-right font-data text-xs text-text">
                  {receipt.versions?.scorer ?? "—"}
                </dd>
                <dt className="text-text-faint">Calibration</dt>
                <dd className="text-right font-data text-xs text-text">
                  {receipt.versions?.confidence_calibration ?? "—"}
                </dd>
                <dt className="text-text-faint">Decided</dt>
                <dd className="text-right font-data text-xs text-text-dim">
                  {formatDateTime(receipt.created_at)}
                </dd>
              </dl>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function PendingPanel({
  liveStatus,
  timedOut,
  onRefresh,
}: {
  liveStatus: LeadStatus | null;
  timedOut: boolean;
  onRefresh: () => void;
}) {
  return (
    <Panel accent="machine">
      <Eyebrow>Still processing</Eyebrow>
      <p className="mt-1 text-sm text-text-dim">
        Current status:{" "}
        <span className="text-text">{liveStatus ? statusLabel(liveStatus) : "checking…"}</span>
      </p>
      <ol className="mt-3 flex flex-wrap gap-2">
        {PROCESSING_SEQUENCE.map((stage) => (
          <li
            key={stage}
            className={
              "rounded-full border px-2.5 py-1 font-data text-[0.65rem] " +
              (stage === liveStatus
                ? "border-machine text-machine"
                : "border-border text-text-faint")
            }
          >
            {statusLabel(stage)}
          </li>
        ))}
      </ol>
      {timedOut && (
        <div className="mt-4 flex items-center gap-3">
          <p className="text-sm text-text-dim">
            Still hasn&apos;t settled after 20s of watching. It may still finish shortly.
          </p>
          <button
            onClick={onRefresh}
            className="rounded-lg border border-border-strong px-3 py-1.5 text-sm text-text hover:border-machine hover:text-machine"
          >
            Check again
          </button>
        </div>
      )}
    </Panel>
  );
}

function StatusPanel({
  tone,
  title,
  children,
}: {
  tone: "reject";
  title: string;
  children: React.ReactNode;
}) {
  void tone;
  return (
    <div className="mx-auto max-w-xl">
      <Panel accent="reject">
        <Eyebrow>ARIE</Eyebrow>
        <h1 className="mt-1 font-display text-xl font-medium text-text">{title}</h1>
        <div className="mt-2 text-sm text-text-dim">{children}</div>
      </Panel>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-panel" />
      ))}
    </div>
  );
}
