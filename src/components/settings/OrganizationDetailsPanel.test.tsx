import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrganizationDetailsPanel } from "./OrganizationDetailsPanel";
import { ArieApiError } from "@/lib/api/errors";
import type { OrganizationResponse } from "@/lib/api/types";

const { getOrganizationMock, updateOrganizationMock } = vi.hoisted(() => ({
  getOrganizationMock: vi.fn(),
  updateOrganizationMock: vi.fn(),
}));
vi.mock("@/lib/api/organization", () => ({
  getOrganization: getOrganizationMock,
  updateOrganization: updateOrganizationMock,
}));

function makeOrg(overrides: Partial<OrganizationResponse> = {}): OrganizationResponse {
  return {
    organization_id: "org-1",
    name: "Acme Revenue Team",
    slug: "acme-revenue-team",
    status: "active",
    timezone: "America/New_York",
    company_domain: "acme.example",
    onboarding_completed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("OrganizationDetailsPanel", () => {
  beforeEach(() => {
    getOrganizationMock.mockReset();
    updateOrganizationMock.mockReset();
  });

  it("loads and renders the organization's current settings", async () => {
    getOrganizationMock.mockResolvedValue(makeOrg());
    render(<OrganizationDetailsPanel canEdit={true} />);

    expect(screen.getByText(/loading organization settings/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Acme Revenue Team")).toBeInTheDocument());
    expect(screen.getByText("acme.example")).toBeInTheDocument();
    expect(screen.getByText("America/New_York")).toBeInTheDocument();
  });

  it("shows a load error instead of stale data", async () => {
    getOrganizationMock.mockRejectedValue(new Error("network down"));
    render(<OrganizationDetailsPanel canEdit={true} />);
    await waitFor(() => expect(screen.getByText("network down")).toBeInTheDocument());
  });

  it("hides the edit control for a non-admin member", async () => {
    getOrganizationMock.mockResolvedValue(makeOrg());
    render(<OrganizationDetailsPanel canEdit={false} />);
    await waitFor(() => expect(screen.getByText("Acme Revenue Team")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
  });

  it("lets an admin edit and save, sending only the changed fields", async () => {
    const user = userEvent.setup();
    getOrganizationMock.mockResolvedValue(makeOrg());
    updateOrganizationMock.mockResolvedValue(makeOrg({ name: "New Name" }));

    render(<OrganizationDetailsPanel canEdit={true} />);
    await waitFor(() => expect(screen.getByText("Acme Revenue Team")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /edit/i }));
    const nameInput = screen.getByLabelText(/name/i, { selector: "input" }) as HTMLInputElement;
    await user.clear(nameInput);
    await user.type(nameInput, "New Name");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(updateOrganizationMock).toHaveBeenCalledTimes(1));
    const [payload] = updateOrganizationMock.mock.calls[0];
    expect(payload.name).toBe("New Name");
    expect(payload.timezone).toBeUndefined();
    expect(payload.company_domain).toBeUndefined();
    await waitFor(() => expect(screen.getByText("New Name")).toBeInTheDocument());
  });

  it("shows a validation error from the backend without discarding the form", async () => {
    const user = userEvent.setup();
    getOrganizationMock.mockResolvedValue(makeOrg());
    updateOrganizationMock.mockRejectedValue(
      new ArieApiError("timezone must be a valid IANA name", 422),
    );

    render(<OrganizationDetailsPanel canEdit={true} />);
    await waitFor(() => expect(screen.getByText("Acme Revenue Team")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /edit/i }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(screen.getByText("timezone must be a valid IANA name")).toBeInTheDocument(),
    );
    // Still on the edit form, not silently reverted to read-only.
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
  });
});
