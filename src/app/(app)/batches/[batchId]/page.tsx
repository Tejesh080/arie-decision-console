"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CircleAlert } from "lucide-react";
import { getBatch, listBatchRows } from "@/lib/api/batches";
import { ArieNotFoundError } from "@/lib/api/errors";
import type { Batch, BatchRowsPage } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { costNoun, costCaveat } from "@/lib/api/providerMode";
import { formatUsd } from "@/lib/format";
import { Panel, Eyebrow, PanelHeader } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StatRow, Stat } from "@/components/ui/Stat";

const POLL_MS = 3000;
const ROWS_PER_PAGE = 50;

export default function BatchDetailPage() {
  const params = useParams<{ batchId: string }>();
  const batchId = params.batchId;

  const [batch, setBatch] = useState<Batch | null>(null);
  const [rows, setRows] = useState<BatchRowsPage | null>(null);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [b, r] = await Promise.all([
        getBatch(batchId),
        listBatchRows(batchId, ROWS_PER_PAGE, offset),
      ]);
      setBatch(b);
      setRows(r);
      setError(null);
    } catch (err) {
      if (err instanceof ArieNotFoundError) {
        setNotFound(true);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setLoading(false);
    }
  }, [batchId, offset]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, offset]);

  useEffect(() => {
    if (!batch || batch.progress.is_complete) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(() => void refresh(), POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch?.progress.is_complete]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-[900px] px-5 py-14 sm:px-8">
        <Panel padding="lg">
          <p className="text-sm text-text-dim">No batch found with this ID.</p>
          <Link href="/batches" className="mt-3 inline-block text-sm text-machine hover:underline">
            Back to batches
          </Link>
        </Panel>
      </div>
    );
  }

  if (loading || !batch) {
    return (
      <div className="mx-auto max-w-[900px] px-5 py-14 sm:px-8">
        <p className="text-sm text-text-faint">Loading batch…</p>
      </div>
    );
  }

  const progress = batch.progress;

  return (
    <div className="mx-auto max-w-[1000px] px-5 py-10 sm:px-8">
      <Link
        href="/batches"
        className="mb-6 inline-flex items-center gap-1.5 text-xs text-text-faint hover:text-text"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
        All batches
      </Link>

      <header className="mb-6">
        <Eyebrow>Batch</Eyebrow>
        <h1 className="t-h1 mt-2 truncate text-text">{batch.filename}</h1>
        <p className="mt-2 text-sm text-text-faint">Uploaded {formatDateTime(batch.created_at)}</p>
      </header>

      {error && (
        <Panel className="mb-6" accent="reject">
          <p className="flex items-center gap-2 text-sm text-text">
            <CircleAlert aria-hidden className="h-4 w-4 shrink-0 text-reject" strokeWidth={2.25} />
            {error}
          </p>
        </Panel>
      )}

      <Panel padding="lg" className="mb-6" accent={progress.is_complete ? "qualify" : "human"}>
        <PanelHeader
          eyebrow="Progress"
          title={progress.is_complete ? "Processing complete" : "Processing…"}
          trailing={
            <Badge tone={progress.is_complete ? "qualify" : "human"}>
              {progress.is_complete ? "Complete" : "In progress"}
            </Badge>
          }
        />
        <div className="mt-5">
          <StatRow>
            <Stat label="Total rows" value={progress.total_rows} />
            <Stat label="Accepted" value={progress.accepted_rows} />
            <Stat label="Rejected (invalid)" value={progress.rejected_rows} />
            <Stat
              label="Still processing"
              value={progress.processing_count}
              tone={progress.processing_count > 0 ? "human" : "default"}
            />
          </StatRow>
        </div>
        <div className="mt-6">
          <StatRow>
            <Stat label="Qualified" value={progress.qualified_count} tone="qualify" />
            <Stat label="Rejected" value={progress.rejected_lead_count} tone="reject" />
            <Stat label="Human review" value={progress.review_count} tone="human" />
            <Stat
              label="Failed"
              value={progress.failed_count}
              tone={progress.failed_count > 0 ? "reject" : "default"}
            />
          </StatRow>
        </div>
      </Panel>

      <Panel className="mb-6">
        <Eyebrow>{costNoun()}</Eyebrow>
        <div className="mt-4">
          <StatRow>
            <Stat label="Providers" value={formatUsd(progress.provider_cost_usd)} />
            <Stat label="Models" value={formatUsd(progress.model_cost_usd)} />
            <Stat label="Total" value={formatUsd(progress.total_cost_usd)} />
          </StatRow>
        </div>
        <p className="mt-4 text-[0.6875rem] leading-relaxed text-text-faint">{costCaveat()}</p>
      </Panel>

      <section>
        <h2 className="t-h3 mb-3 text-text">Rows</h2>
        {rows && rows.items.length > 0 ? (
          <>
            <div className="scroll-x rounded-md border border-border">
              <table className="w-full min-w-[36rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border bg-bg-sunken">
                    <Th>#</Th>
                    <Th>Email</Th>
                    <Th>Status</Th>
                    <Th>Lead status</Th>
                    <Th align="right">Receipt</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.items.map((row) => (
                    <tr key={row.row_number} className="border-b border-border last:border-0">
                      <td className="t-data px-3 py-2.5 text-text-faint">{row.row_number}</td>
                      <td className="t-data px-3 py-2.5 text-text">
                        {row.raw_row.email ?? row.raw_row.Email ?? "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge
                          tone={row.validation_status === "accepted" ? "qualify" : "reject"}
                          size="sm"
                        >
                          {row.validation_status}
                        </Badge>
                        {row.validation_error && (
                          <p className="mt-1 text-[0.6875rem] text-text-faint">
                            {row.validation_error}
                          </p>
                        )}
                      </td>
                      <td className="t-data px-3 py-2.5 text-text-dim">{row.lead_status ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right">
                        {row.lead_id ? (
                          <Link
                            href={`/leads/${row.lead_id}`}
                            className="text-xs text-machine hover:underline"
                          >
                            View
                          </Link>
                        ) : (
                          <span className="text-xs text-text-faint">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-text-faint">
                Showing {offset + 1}–{Math.min(offset + ROWS_PER_PAGE, rows.total)} of {rows.total}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - ROWS_PER_PAGE))}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={offset + ROWS_PER_PAGE >= rows.total}
                  onClick={() => setOffset(offset + ROWS_PER_PAGE)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : (
          <Panel>
            <p className="text-sm text-text-faint">No rows to show.</p>
          </Panel>
        )}
      </section>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      scope="col"
      className={`t-label px-3 py-2 font-medium text-text-faint ${align === "right" ? "text-right" : ""}`}
    >
      {children}
    </th>
  );
}
