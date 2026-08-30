"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleAlert, Upload } from "lucide-react";
import { listBatches, uploadBatch } from "@/lib/api/batches";
import { ArieApiError, ArieUnavailableError, ArieValidationError } from "@/lib/api/errors";
import type { Batch } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { costNounShort } from "@/lib/api/providerMode";
import { formatUsdCompact } from "@/lib/format";
import { Panel, Eyebrow } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export default function BatchesPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rowCountHint, setRowCountHint] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      setBatches(await listBatches());
    } catch (err) {
      setListError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setUploadError(null);
    setRowCountHint(null);
    if (!file) return;
    // A quick, best-effort line count for the "N rows detected" preview —
    // never the authoritative validation, which only the backend performs
    // (see arie.batches.parse_csv). Don't pretend this is more than a hint.
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
      setRowCountHint(Math.max(0, lines.length - 1));
    } catch {
      setRowCountHint(null);
    }
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    setUploadError(null);
    try {
      const batch = await uploadBatch(selectedFile);
      router.push(`/batches/${batch.batch_id}`);
    } catch (err) {
      if (err instanceof ArieValidationError) {
        setUploadError(`ARIE couldn't accept this file: ${err.message}`);
      } else if (err instanceof ArieUnavailableError) {
        setUploadError("ARIE's backend didn't respond. Nothing was lost — try again in a moment.");
      } else if (err instanceof ArieApiError) {
        setUploadError(err.message);
      } else {
        setUploadError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1000px] px-5 py-10 sm:px-8">
      <header className="mb-8">
        <Eyebrow>Batches</Eyebrow>
        <h1 className="t-h1 mt-2 text-text">Bulk lead upload</h1>
        <p className="mt-3 max-w-2xl text-[0.9375rem] leading-relaxed text-text-dim">
          Upload a CSV of leads — ARIE validates every row, imports the well-formed ones, and
          processes them through the same decision engine as a single submitted lead.
        </p>
      </header>

      <Panel padding="lg" className="mb-8" accent="machine">
        <Eyebrow>Upload CSV</Eyebrow>
        <p className="mt-2 text-sm text-text-dim">
          Required column: <span className="t-data text-text">email</span>. Optional:{" "}
          <span className="t-data text-text">first_name</span>,{" "}
          <span className="t-data text-text">last_name</span>,{" "}
          <span className="t-data text-text">company</span>,{" "}
          <span className="t-data text-text">domain</span>,{" "}
          <span className="t-data text-text">title</span>.
        </p>

        <div className="mt-5 flex flex-col gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="text-sm text-text-dim file:mr-3 file:rounded-md file:border file:border-border-strong file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm file:text-text hover:file:bg-surface-3"
          />

          {selectedFile && (
            <p className="text-xs text-text-faint">
              {selectedFile.name}
              {rowCountHint !== null && ` — ~${rowCountHint} row(s) detected`}. Uploading validates
              every row; this is only a preview count.
            </p>
          )}

          {uploadError && (
            <p className="flex items-center gap-2 rounded-md border border-reject-edge bg-reject-dim px-3 py-2 text-sm text-text">
              <CircleAlert
                aria-hidden
                className="h-4 w-4 shrink-0 text-reject"
                strokeWidth={2.25}
              />
              {uploadError}
            </p>
          )}

          <div>
            <Button variant="primary" onClick={handleUpload} disabled={!selectedFile || uploading}>
              <Upload className="h-4 w-4" strokeWidth={2.25} />
              {uploading ? "Uploading and validating…" : "Upload and process"}
            </Button>
          </div>
        </div>
      </Panel>

      <section>
        <h2 className="t-h2 mb-4 text-text">Recent batches</h2>
        {listError && <p className="text-sm text-reject">{listError}</p>}
        {loading ? (
          <p className="text-sm text-text-faint">Loading…</p>
        ) : batches.length === 0 ? (
          <Panel padding="lg">
            <p className="text-sm text-text-dim">
              No batches uploaded yet — the one you upload above will appear here.
            </p>
          </Panel>
        ) : (
          <ul className="flex flex-col gap-3">
            {batches.map((batch) => (
              <li key={batch.batch_id}>
                <a
                  href={`/batches/${batch.batch_id}`}
                  className="group flex items-center justify-between gap-4 rounded-md border border-border bg-bg-sunken p-4 transition-colors hover:border-border-loud hover:bg-surface-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text">{batch.filename}</p>
                    <p className="t-data mt-1 text-xs text-text-faint">
                      {formatDateTime(batch.created_at)} · {batch.total_rows} rows ·{" "}
                      {batch.accepted_rows} accepted · {batch.rejected_rows} rejected
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge tone={batch.progress.is_complete ? "qualify" : "human"} size="sm">
                      {batch.progress.is_complete ? "Complete" : "Processing"}
                    </Badge>
                    <span className="t-data hidden text-xs text-text-faint sm:inline">
                      {costNounShort()}: {formatUsdCompact(batch.progress.total_cost_usd)}
                    </span>
                    <ArrowRight
                      aria-hidden
                      className="h-4 w-4 text-text-faint opacity-0 transition-opacity group-hover:opacity-100"
                      strokeWidth={2}
                    />
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
