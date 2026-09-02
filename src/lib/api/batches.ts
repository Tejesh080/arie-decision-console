import { apiClient } from "./client";
import { getDataMode } from "./mode";
import { mockStore } from "./mock/store";
import type { Batch, BatchRowsPage } from "./types";

export async function uploadBatch(file: File, fieldMap?: Record<string, string>): Promise<Batch> {
  if (getDataMode() === "mock") {
    const rows = await parseCsvForMock(file);
    return mockStore.uploadBatch(file.name, rows);
  }
  const form = new FormData();
  form.append("file", file);
  // M7 Slice 3. Optional: omitting it leaves `arie.batches`' own alias matching
  // in charge, which is exactly what every caller got before the mapping step
  // existed. The server revalidates whatever is sent.
  if (fieldMap && Object.keys(fieldMap).length > 0) {
    form.append("mapping", JSON.stringify(fieldMap));
  }
  // Uploading and synchronously ingesting every row can take a while on a
  // cold hosted backend — see `submitLead`'s identical reasoning for its own
  // 28s timeout, above the transport default and just under the server
  // proxy's 25s abort plus a margin for the response to come back.
  return apiClient.postForm<Batch>("/batches", form, { timeoutMs: 28_000 });
}

export async function listBatches(limit = 20, offset = 0): Promise<Batch[]> {
  if (getDataMode() === "mock") return mockStore.listBatches();
  return apiClient.get<Batch[]>(`/batches?limit=${limit}&offset=${offset}`);
}

export async function getBatch(batchId: string): Promise<Batch> {
  if (getDataMode() === "mock") return mockStore.getBatch(batchId);
  return apiClient.get<Batch>(`/batches/${encodeURIComponent(batchId)}`);
}

export async function listBatchRows(
  batchId: string,
  limit = 50,
  offset = 0,
): Promise<BatchRowsPage> {
  if (getDataMode() === "mock") return mockStore.listBatchRows(batchId);
  return apiClient.get<BatchRowsPage>(
    `/batches/${encodeURIComponent(batchId)}/leads?limit=${limit}&offset=${offset}`,
  );
}

/** Mock mode has no server to parse a CSV, so this does the minimal
 * client-side split the real backend's `arie.batches.parse_csv` does more
 * rigorously — good enough for a demo file, never the authoritative parser
 * (that's the whole reason "api" mode exists). */
async function parseCsvForMock(
  file: File,
): Promise<
  { email: string; full_name?: string; company_name?: string; company_domain?: string }[]
> {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const emailIndex = headers.findIndex((h) => h === "email" || h === "email address");
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    return {
      email: emailIndex >= 0 ? (cells[emailIndex] ?? "").trim() : "",
      full_name: cells[headers.indexOf("full_name")]?.trim() || undefined,
      company_name: cells[headers.indexOf("company")]?.trim() || undefined,
      company_domain: cells[headers.indexOf("domain")]?.trim() || undefined,
    };
  });
}
