import { apiClient } from "./client";
import { getDataMode } from "./mode";
import type { ICPProfile, MappingPreview, OutcomeAnalysis, RevisionProposal } from "./types";

/**
 * Ask ARIE what a file's columns are, before uploading it.
 *
 * Costs nothing for a file whose headings are all recognised — the backend
 * reaches a model only for genuinely ambiguous columns. Nothing is ingested and
 * nothing is stored by this call, so a customer can preview a file, change
 * their mind, and have left no trace.
 */
export async function previewMapping(file: File): Promise<MappingPreview> {
  if (getDataMode() === "mock") return mockPreview(file);
  const form = new FormData();
  form.append("file", file);
  return apiClient.postForm<MappingPreview>("/batches/mapping-preview", form, {
    timeoutMs: 60_000,
  });
}

export async function analyzeOutcomes(file: File): Promise<OutcomeAnalysis> {
  const form = new FormData();
  form.append("file", file);
  return apiClient.postForm<OutcomeAnalysis>("/intelligence/outcomes/analyze", form, {
    timeoutMs: 60_000,
  });
}

export async function listProposals(): Promise<RevisionProposal[]> {
  if (getDataMode() === "mock") return [];
  return apiClient.get<RevisionProposal[]>("/intelligence/proposals");
}

export async function getProposal(proposalId: string): Promise<RevisionProposal> {
  return apiClient.get<RevisionProposal>(
    `/intelligence/proposals/${encodeURIComponent(proposalId)}`,
  );
}

export async function rejectProposal(proposalId: string): Promise<RevisionProposal> {
  return apiClient.post<RevisionProposal>(
    `/intelligence/proposals/${encodeURIComponent(proposalId)}/reject`,
    {},
  );
}

/**
 * Applying a suggestion creates a new immutable targeting version.
 *
 * The changes come from the stored proposal, never from this client — all it
 * sends is a name. A client that could post its own changes would be posting a
 * targeting profile, which is what the targeting screen is for.
 */
export async function acceptProposal(proposalId: string, name: string): Promise<ICPProfile> {
  return apiClient.post<ICPProfile>(
    `/intelligence/proposals/${encodeURIComponent(proposalId)}/accept`,
    { name },
  );
}

const MOCK_FIELDS: Record<string, { field: string; label: string }> = {
  email: { field: "email", label: "Email" },
  "email address": { field: "email", label: "Email" },
  "work email": { field: "email", label: "Email" },
  company: { field: "company_name", label: "Company" },
  "company name": { field: "company_name", label: "Company" },
  business: { field: "company_name", label: "Company" },
  title: { field: "title", label: "Job title" },
  "job title": { field: "title", label: "Job title" },
  role: { field: "title", label: "Job title" },
  domain: { field: "company_domain", label: "Company website" },
  website: { field: "company_domain", label: "Company website" },
  web: { field: "company_domain", label: "Company website" },
  "full name": { field: "full_name", label: "Contact name" },
  contact: { field: "full_name", label: "Contact name" },
};

/**
 * Demo mode has no backend to read the file, so this repeats the same crude
 * header match the real deterministic matcher does for obvious spellings.
 *
 * Enough for a demo to show the "columns understood" screen honestly, and never
 * the authoritative mapping — that is `arie.intelligence.csv_mapping`, which
 * knows about ambiguity, conflicts and the columns ARIE cannot store.
 */
async function mockPreview(file: File): Promise<MappingPreview> {
  const text = await file.text();
  const headers = (text.split(/\r?\n/)[0] ?? "").split(",").map((h) => h.trim());
  const columns = headers
    .filter((header) => header.length > 0)
    .map((header) => {
      const match = MOCK_FIELDS[header.toLowerCase().replace(/[_-]+/g, " ")];
      return {
        source_column: header,
        canonical_field: match?.field ?? null,
        label: match?.label ?? null,
        confidence: (match ? "high" : "unmapped") as MappedConfidence,
        reason: match
          ? `Read as ${match.label.toLowerCase()}.`
          : "ARIE did not recognise this column.",
        requires_confirmation: false,
        candidates: [],
      };
    });

  const fieldMap: Record<string, string> = {};
  for (const column of columns) {
    if (column.canonical_field && !(column.canonical_field in fieldMap)) {
      fieldMap[column.canonical_field] = column.source_column;
    }
  }

  return {
    columns,
    field_map: fieldMap,
    ignored_columns: columns.filter((c) => !c.canonical_field).map((c) => c.source_column),
    conflicts: [],
    warnings: [],
    requires_confirmation: false,
    usable: "email" in fieldMap,
    mapping_method: "deterministic",
    available_fields: [
      {
        name: "email",
        label: "Email",
        description: "The email address for this contact.",
        required: true,
      },
      {
        name: "full_name",
        label: "Contact name",
        description: "The person's full name.",
        required: false,
      },
      {
        name: "company_name",
        label: "Company",
        description: "The company this contact works for.",
        required: false,
      },
      {
        name: "company_domain",
        label: "Company website",
        description: "The company's website or domain.",
        required: false,
      },
      {
        name: "title",
        label: "Job title",
        description: "The contact's job title or role.",
        required: false,
      },
    ],
    llm_provider: null,
    llm_model: null,
    llm_cost_usd: "0",
    llm_unavailable_reason: null,
  };
}

type MappedConfidence = MappingPreview["columns"][number]["confidence"];
