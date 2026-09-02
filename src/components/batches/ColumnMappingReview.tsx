"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import type { MappingPreview } from "@/lib/api/types";
import { Panel, Eyebrow } from "@/components/ui/Panel";

/**
 * What ARIE understood about a file's columns, before it is uploaded.
 *
 * Two shapes, decided by `requires_confirmation`. When every column is clear
 * this is a short confirmation the customer reads and moves past; when
 * something is ambiguous, or two columns claim the same field, it becomes the
 * correction screen. The customer is never asked to check a file that had
 * nothing worth checking.
 *
 * Nothing here computes a mapping. `onChange` posts a canonical field name back
 * to the parent, which sends it to the server, which revalidates it — a
 * dropdown in this component cannot make ARIE ingest a column it should not.
 */

const CONFIDENCE_NOTE: Record<MappingPreview["columns"][number]["confidence"], string> = {
  exact: "Clear",
  high: "Clear",
  ambiguous: "Please check",
  unmapped: "Not used",
};

export function ColumnMappingReview({
  preview,
  fieldMap,
  onChange,
  disabled = false,
}: {
  preview: MappingPreview;
  /** Canonical field -> column heading, as it currently stands. */
  fieldMap: Record<string, string>;
  onChange: (sourceColumn: string, canonicalField: string | null) => void;
  disabled?: boolean;
}) {
  const mapped = preview.columns.filter((column) => column.canonical_field !== null);
  const needsAttention = preview.columns.filter((column) => column.requires_confirmation);
  const ignored = preview.columns.filter(
    (column) => column.canonical_field === null && !column.requires_confirmation,
  );

  /** Which column is currently assigned to a field, so a dropdown can warn
   * before a customer takes a field away from another column. */
  function assignedTo(field: string): string | undefined {
    return fieldMap[field];
  }

  return (
    <Panel className="mb-6">
      <Eyebrow>
        {preview.requires_confirmation ? "Check these columns" : "Columns understood"}
      </Eyebrow>

      {!preview.requires_confirmation && (
        <p className="mt-2 flex items-center gap-2 text-sm text-text-dim">
          <CircleCheck className="size-4 shrink-0 text-qualify" aria-hidden />
          ARIE recognised every column it needs. Nothing to check.
        </p>
      )}

      {preview.conflicts.map((conflict) => (
        <p
          key={conflict}
          className="mt-3 flex items-start gap-2 rounded-md border border-reject-edge bg-reject-dim px-3 py-2 text-sm text-text"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-reject" aria-hidden />
          {conflict}
        </p>
      ))}

      {preview.warnings.map((warning) => (
        <p
          key={warning}
          className="mt-3 flex items-start gap-2 rounded-md border border-reject-edge bg-reject-dim px-3 py-2 text-sm text-text"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-reject" aria-hidden />
          {warning}
        </p>
      ))}

      {preview.llm_unavailable_reason && (
        <p className="mt-3 text-xs text-text-faint">{preview.llm_unavailable_reason}</p>
      )}

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-edge text-xs uppercase tracking-wide text-text-faint">
              <th scope="col" className="pb-2 pr-4 font-medium">
                Your column
              </th>
              <th scope="col" className="pb-2 pr-4 font-medium">
                ARIE understood as
              </th>
              <th scope="col" className="pb-2 font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {[...needsAttention, ...mapped].map((column) => (
              <tr key={column.source_column} className="border-b border-edge/60">
                <td className="py-2.5 pr-4 text-text">{column.source_column}</td>
                <td className="py-2.5 pr-4">
                  <label className="sr-only" htmlFor={`map-${column.source_column}`}>
                    What {column.source_column} holds
                  </label>
                  <select
                    id={`map-${column.source_column}`}
                    value={column.canonical_field ?? ""}
                    disabled={disabled}
                    onChange={(event) => onChange(column.source_column, event.target.value || null)}
                    className="rounded-md border border-edge bg-surface px-2 py-1 text-sm text-text focus:border-accent focus:outline-none disabled:opacity-50"
                  >
                    <option value="">Do not use this column</option>
                    {preview.available_fields.map((field) => {
                      const taken = assignedTo(field.name);
                      const takenByAnother = taken && taken !== column.source_column;
                      return (
                        <option key={field.name} value={field.name}>
                          {field.label}
                          {field.required ? " (required)" : ""}
                          {takenByAnother ? ` — currently ${taken}` : ""}
                        </option>
                      );
                    })}
                  </select>
                </td>
                <td className="py-2.5 text-xs text-text-faint">
                  {CONFIDENCE_NOTE[column.confidence]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ignored.length > 0 && (
        <p className="mt-4 text-xs text-text-faint">
          Not used: {ignored.map((column) => column.source_column).join(", ")}. These stay with the
          uploaded rows, but ARIE does not score them.
        </p>
      )}
    </Panel>
  );
}
