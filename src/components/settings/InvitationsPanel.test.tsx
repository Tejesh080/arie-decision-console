import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InvitationsPanel } from "./InvitationsPanel";
import { ArieApiError } from "@/lib/api/errors";
import type { InvitationCreatedResponse, InvitationResponse } from "@/lib/api/types";

const { listInvitationsMock, createInvitationMock, revokeInvitationMock, resendInvitationMock } =
  vi.hoisted(() => ({
    listInvitationsMock: vi.fn(),
    createInvitationMock: vi.fn(),
    revokeInvitationMock: vi.fn(),
    resendInvitationMock: vi.fn(),
  }));
vi.mock("@/lib/api/invitations", () => ({
  listInvitations: listInvitationsMock,
  createInvitation: createInvitationMock,
  revokeInvitation: revokeInvitationMock,
  resendInvitation: resendInvitationMock,
}));

function makeInvitation(overrides: Partial<InvitationResponse> = {}): InvitationResponse {
  return {
    invitation_id: "invite-1",
    organization_id: "org-1",
    email_normalized: "invitee@example.com",
    role: "admin",
    status: "pending",
    invited_by_user_id: "self-1",
    created_at: "2026-01-01T00:00:00Z",
    expires_at: "2026-01-08T00:00:00Z",
    accepted_at: null,
    revoked_at: null,
    email_status: "sent",
    email_error: null,
    email_sent_at: "2026-01-01T00:00:01Z",
    ...overrides,
  };
}

describe("InvitationsPanel", () => {
  beforeEach(() => {
    listInvitationsMock.mockReset();
    createInvitationMock.mockReset();
    revokeInvitationMock.mockReset();
    resendInvitationMock.mockReset();
  });

  it("lists pending invitations and separates resolved ones into history", async () => {
    listInvitationsMock.mockResolvedValue([
      makeInvitation({ invitation_id: "a", status: "pending" }),
      makeInvitation({ invitation_id: "b", status: "revoked", email_normalized: "old@x.com" }),
    ]);
    render(<InvitationsPanel canEdit={true} />);
    await waitFor(() => expect(screen.getByText("invitee@example.com")).toBeInTheDocument());
    expect(screen.getByText("old@x.com")).toBeInTheDocument();
    expect(screen.getByText("History")).toBeInTheDocument();
  });

  it("hides the create form for a non-admin", async () => {
    listInvitationsMock.mockResolvedValue([]);
    render(<InvitationsPanel canEdit={false} />);
    await waitFor(() => expect(listInvitationsMock).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /create invitation/i })).not.toBeInTheDocument();
  });

  it("creates an invitation and shows the one-time raw token as a copyable link", async () => {
    const user = userEvent.setup();
    listInvitationsMock.mockResolvedValue([]);
    const created: InvitationCreatedResponse = {
      ...makeInvitation(),
      raw_token: "raw-secret-token-value",
    };
    createInvitationMock.mockResolvedValue(created);

    render(<InvitationsPanel canEdit={true} />);
    await waitFor(() => expect(listInvitationsMock).toHaveBeenCalled());

    await user.type(screen.getByPlaceholderText(/teammate@company.com/i), "invitee@example.com");
    await user.click(screen.getByRole("button", { name: /create invitation/i }));

    await waitFor(() =>
      expect(createInvitationMock).toHaveBeenCalledWith({
        email: "invitee@example.com",
        role: "analyst_reviewer",
      }),
    );
    await waitFor(() => expect(screen.getByText(/copy this link now/i)).toBeInTheDocument());
    expect(screen.getByText(/raw-secret-token-value/)).toBeInTheDocument();

    // Never rendered a second time once dismissed.
    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByText(/raw-secret-token-value/)).not.toBeInTheDocument();
  });

  it("revokes a pending invitation", async () => {
    const user = userEvent.setup();
    listInvitationsMock.mockResolvedValue([makeInvitation()]);
    revokeInvitationMock.mockResolvedValue(makeInvitation({ status: "revoked" }));

    render(<InvitationsPanel canEdit={true} />);
    await waitFor(() => expect(screen.getByText("invitee@example.com")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /revoke invitation/i }));
    await waitFor(() => expect(revokeInvitationMock).toHaveBeenCalledWith("invite-1"));
    await waitFor(() => expect(screen.getByText("revoked")).toBeInTheDocument());
  });

  it("offers a resend affordance only when email delivery failed", async () => {
    listInvitationsMock.mockResolvedValue([makeInvitation({ email_status: "failed" })]);
    render(<InvitationsPanel canEdit={true} />);
    await waitFor(() => expect(screen.getByText("invitee@example.com")).toBeInTheDocument());
    expect(screen.getByText(/email delivery failed/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^resend$/i })).toBeInTheDocument();
  });

  it("does not offer resend once email delivery succeeded", async () => {
    listInvitationsMock.mockResolvedValue([makeInvitation({ email_status: "sent" })]);
    render(<InvitationsPanel canEdit={true} />);
    await waitFor(() => expect(screen.getByText("invitee@example.com")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /^resend$/i })).not.toBeInTheDocument();
  });

  it("resends a failed invitation and shows the new one-time link", async () => {
    const user = userEvent.setup();
    listInvitationsMock.mockResolvedValue([makeInvitation({ email_status: "failed" })]);
    resendInvitationMock.mockResolvedValue({
      ...makeInvitation({ invitation_id: "invite-2" }),
      raw_token: "new-raw-token",
    });

    render(<InvitationsPanel canEdit={true} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^resend$/i })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /^resend$/i }));
    await waitFor(() => expect(resendInvitationMock).toHaveBeenCalledWith("invite-1"));
    await waitFor(() => expect(screen.getByText(/new-raw-token/)).toBeInTheDocument());
  });

  it("shows a create error without losing the entered email", async () => {
    const user = userEvent.setup();
    listInvitationsMock.mockResolvedValue([]);
    createInvitationMock.mockRejectedValue(
      new ArieApiError("a pending invitation already exists for invitee@example.com", 409),
    );

    render(<InvitationsPanel canEdit={true} />);
    await waitFor(() => expect(listInvitationsMock).toHaveBeenCalled());
    const emailInput = screen.getByPlaceholderText(/teammate@company.com/i) as HTMLInputElement;
    await user.type(emailInput, "invitee@example.com");
    await user.click(screen.getByRole("button", { name: /create invitation/i }));

    await waitFor(() =>
      expect(
        screen.getByText("a pending invitation already exists for invitee@example.com"),
      ).toBeInTheDocument(),
    );
  });
});
