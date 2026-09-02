import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ColumnMappingReview } from "./ColumnMappingReview";
import type { MappingPreview } from "@/lib/api/types";

const FIELDS: MappingPreview["available_fields"] = [
  { name: "email", label: "Email", description: "The email address.", required: true },
  { name: "full_name", label: "Contact name", description: "The person's name.", required: false },
  { name: "company_name", label: "Company", description: "The company name.", required: false },
  { name: "title", label: "Job title", description: "The job title.", required: false },
];

function preview(overrides: Partial<MappingPreview> = {}): MappingPreview {
  return {
    columns: [
      {
        source_column: "Company Name",
        canonical_field: "company_name",
        label: "Company",
        confidence: "exact",
        reason: "Read as company.",
        requires_confirmation: false,
        candidates: [],
      },
      {
        source_column: "Work Email",
        canonical_field: "email",
        label: "Email",
        confidence: "exact",
        reason: "Read as email.",
        requires_confirmation: false,
        candidates: [],
      },
      {
        source_column: "Team Size",
        canonical_field: null,
        label: null,
        confidence: "unmapped",
        reason: "Kept with the row, but ARIE does not use this yet.",
        requires_confirmation: false,
        candidates: [],
      },
    ],
    field_map: { company_name: "Company Name", email: "Work Email" },
    ignored_columns: ["Team Size"],
    conflicts: [],
    warnings: [],
    requires_confirmation: false,
    usable: true,
    mapping_method: "deterministic",
    available_fields: FIELDS,
    llm_provider: null,
    llm_model: null,
    llm_cost_usd: "0",
    llm_unavailable_reason: null,
    ...overrides,
  };
}

const AMBIGUOUS = preview({
  columns: [
    {
      source_column: "Business",
      canonical_field: "company_name",
      label: "Company",
      confidence: "high",
      reason: "Read as company.",
      requires_confirmation: false,
      candidates: [],
    },
    {
      source_column: "Contact",
      canonical_field: null,
      label: null,
      confidence: "ambiguous",
      reason: "This could mean more than one thing.",
      requires_confirmation: true,
      candidates: ["full_name", "email"],
    },
    {
      source_column: "Email Address",
      canonical_field: "email",
      label: "Email",
      confidence: "exact",
      reason: "Read as email.",
      requires_confirmation: false,
      candidates: [],
    },
  ],
  field_map: { company_name: "Business", email: "Email Address" },
  ignored_columns: [],
  requires_confirmation: true,
});

describe("ColumnMappingReview", () => {
  it("confirms briefly when every column was understood", () => {
    render(
      <ColumnMappingReview preview={preview()} fieldMap={preview().field_map} onChange={vi.fn()} />,
    );
    expect(screen.getByText("Columns understood")).toBeInTheDocument();
    expect(screen.getByText(/recognised every column it needs/i)).toBeInTheDocument();
    expect(screen.queryByText("Check these columns")).not.toBeInTheDocument();
  });

  it("asks the customer to look when something is ambiguous", () => {
    render(
      <ColumnMappingReview preview={AMBIGUOUS} fieldMap={AMBIGUOUS.field_map} onChange={vi.fn()} />,
    );
    expect(screen.getByText("Check these columns")).toBeInTheDocument();
    // The column needing attention is listed first.
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Contact");
  });

  it("shows customer-facing labels, never canonical identifiers", () => {
    render(
      <ColumnMappingReview preview={preview()} fieldMap={preview().field_map} onChange={vi.fn()} />,
    );
    expect(screen.getByLabelText(/what Work Email holds/i)).toHaveValue("email");
    expect(screen.getByRole("option", { name: /^Email \(required\)$/ })).toBeInTheDocument();
    expect(screen.queryByText("company_name")).not.toBeInTheDocument();
    expect(screen.queryByText("company_domain")).not.toBeInTheDocument();
  });

  it("reports a correction as a canonical field, not as a label", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ColumnMappingReview
        preview={AMBIGUOUS}
        fieldMap={AMBIGUOUS.field_map}
        onChange={onChange}
      />,
    );
    await user.selectOptions(screen.getByLabelText(/what Contact holds/i), "full_name");
    expect(onChange).toHaveBeenCalledWith("Contact", "full_name");
  });

  it("lets a column be dropped entirely", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ColumnMappingReview
        preview={preview()}
        fieldMap={preview().field_map}
        onChange={onChange}
      />,
    );
    await user.selectOptions(screen.getByLabelText(/what Company Name holds/i), "");
    expect(onChange).toHaveBeenCalledWith("Company Name", null);
  });

  it("says which field another column already holds", () => {
    render(
      <ColumnMappingReview preview={AMBIGUOUS} fieldMap={AMBIGUOUS.field_map} onChange={vi.fn()} />,
    );
    const select = screen.getByLabelText(/what Contact holds/i);
    expect(select).toHaveTextContent("currently Email Address");
  });

  it("lists ignored columns quietly and says they are still kept", () => {
    render(
      <ColumnMappingReview preview={preview()} fieldMap={preview().field_map} onChange={vi.fn()} />,
    );
    expect(screen.getByText(/Not used: Team Size/)).toBeInTheDocument();
    expect(screen.getByText(/stay with the uploaded rows/i)).toBeInTheDocument();
  });

  it("surfaces a conflict rather than choosing for the customer", () => {
    render(
      <ColumnMappingReview
        preview={preview({
          conflicts: [
            "2 columns look like email (Email, Work Email). Choose which one ARIE should use.",
          ],
          requires_confirmation: true,
          usable: false,
        })}
        fieldMap={{}}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/Choose which one ARIE should use/)).toBeInTheDocument();
  });

  it("explains when AI matching was unavailable without treating it as an error", () => {
    render(
      <ColumnMappingReview
        preview={preview({
          llm_unavailable_reason:
            "This organization's AI budget is used up, so please check these columns.",
          requires_confirmation: true,
        })}
        fieldMap={preview().field_map}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/AI budget is used up/)).toBeInTheDocument();
  });
});
