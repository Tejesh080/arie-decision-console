import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InviteAcceptView } from "./InviteAcceptView";
import { ArieApiError } from "@/lib/api/errors";

const { acceptInvitationMock } = vi.hoisted(() => ({ acceptInvitationMock: vi.fn() }));
vi.mock("@/lib/api/invitations", () => ({ acceptInvitation: acceptInvitationMock }));

const { getDataModeMock } = vi.hoisted(() => ({ getDataModeMock: vi.fn(() => "mock") }));
vi.mock("@/lib/api/mode", () => ({ getDataMode: getDataModeMock }));

const { getUserMock, signInWithPasswordMock } = vi.hoisted(() => ({
  getUserMock: vi.fn().mockResolvedValue({ data: { user: null } }),
  signInWithPasswordMock: vi.fn().mockResolvedValue({ error: null }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: getUserMock, signInWithPassword: signInWithPasswordMock },
  }),
}));

describe("InviteAcceptView", () => {
  beforeEach(() => {
    acceptInvitationMock.mockReset();
    getDataModeMock.mockReturnValue("mock");
    getUserMock.mockClear();
    signInWithPasswordMock.mockClear();
    signInWithPasswordMock.mockResolvedValue({ error: null });
  });

  it("shows an error immediately for a missing token", async () => {
    render(<InviteAcceptView token={null} />);
    await waitFor(() =>
      expect(screen.getByText(/missing its token/i)).toBeInTheDocument(),
    );
  });

  it("accepts automatically in mock mode (no Supabase session required)", async () => {
    acceptInvitationMock.mockResolvedValue({
      invitation_id: "i1",
      organization_id: "org-1",
      email_normalized: "me@example.com",
      role: "admin",
      status: "accepted",
      invited_by_user_id: "owner-1",
      created_at: "2026-01-01T00:00:00Z",
      expires_at: "2026-01-08T00:00:00Z",
      accepted_at: "2026-01-02T00:00:00Z",
      revoked_at: null,
    });
    render(<InviteAcceptView token="mock_token_abc" />);
    await waitFor(() => expect(acceptInvitationMock).toHaveBeenCalledWith({ token: "mock_token_abc" }));
    await waitFor(() => expect(screen.getByText(/you've joined the organization/i)).toBeInTheDocument());
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it("renders an inline sign-in form when api mode has no session", async () => {
    getDataModeMock.mockReturnValue("api");
    getUserMock.mockResolvedValue({ data: { user: null } });
    render(<InviteAcceptView token="real-token" />);
    await waitFor(() => expect(screen.getByRole("button", { name: /sign in and accept/i })).toBeInTheDocument());
    expect(acceptInvitationMock).not.toHaveBeenCalled();
  });

  it("accepts immediately when api mode already has a session", async () => {
    getDataModeMock.mockReturnValue("api");
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    acceptInvitationMock.mockResolvedValue({
      invitation_id: "i1",
      organization_id: "org-1",
      email_normalized: "me@example.com",
      role: "admin",
      status: "accepted",
      invited_by_user_id: "owner-1",
      created_at: "2026-01-01T00:00:00Z",
      expires_at: "2026-01-08T00:00:00Z",
      accepted_at: "2026-01-02T00:00:00Z",
      revoked_at: null,
    });
    render(<InviteAcceptView token="real-token" />);
    await waitFor(() => expect(acceptInvitationMock).toHaveBeenCalledWith({ token: "real-token" }));
    await waitFor(() => expect(screen.getByText(/you've joined the organization/i)).toBeInTheDocument());
  });

  it("signs in inline, then accepts the invitation with the same token", async () => {
    const user = userEvent.setup();
    getDataModeMock.mockReturnValue("api");
    getUserMock.mockResolvedValue({ data: { user: null } });
    acceptInvitationMock.mockResolvedValue({
      invitation_id: "i1",
      organization_id: "org-1",
      email_normalized: "me@example.com",
      role: "admin",
      status: "accepted",
      invited_by_user_id: "owner-1",
      created_at: "2026-01-01T00:00:00Z",
      expires_at: "2026-01-08T00:00:00Z",
      accepted_at: "2026-01-02T00:00:00Z",
      revoked_at: null,
    });

    render(<InviteAcceptView token="real-token" />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /sign in and accept/i })).toBeInTheDocument(),
    );

    await user.type(screen.getByLabelText(/email/i), "me@example.com");
    await user.type(screen.getByLabelText(/password/i), "hunter2");
    await user.click(screen.getByRole("button", { name: /sign in and accept/i }));

    await waitFor(() =>
      expect(signInWithPasswordMock).toHaveBeenCalledWith({
        email: "me@example.com",
        password: "hunter2",
      }),
    );
    await waitFor(() => expect(acceptInvitationMock).toHaveBeenCalledWith({ token: "real-token" }));
    await waitFor(() => expect(screen.getByText(/you've joined the organization/i)).toBeInTheDocument());
  });

  it("shows the Supabase sign-in error without attempting acceptance", async () => {
    const user = userEvent.setup();
    getDataModeMock.mockReturnValue("api");
    getUserMock.mockResolvedValue({ data: { user: null } });
    signInWithPasswordMock.mockResolvedValue({ error: { message: "Invalid login credentials" } });

    render(<InviteAcceptView token="real-token" />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /sign in and accept/i })).toBeInTheDocument(),
    );
    await user.type(screen.getByLabelText(/email/i), "me@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrong");
    await user.click(screen.getByRole("button", { name: /sign in and accept/i }));

    await waitFor(() =>
      expect(screen.getByText("Invalid login credentials")).toBeInTheDocument(),
    );
    expect(acceptInvitationMock).not.toHaveBeenCalled();
  });

  it("shows a friendly message for an expired invitation, distinct from an invalid one", async () => {
    acceptInvitationMock.mockRejectedValue(new ArieApiError("invitation x has expired", 410));
    render(<InviteAcceptView token="expired-token" />);
    await waitFor(() => expect(screen.getByText(/this invitation has expired/i)).toBeInTheDocument());
  });

  it("shows a distinct message for an invalid/already-used token", async () => {
    acceptInvitationMock.mockRejectedValue(new ArieApiError("invitation not found", 404));
    render(<InviteAcceptView token="bad-token" />);
    await waitFor(() =>
      expect(
        screen.getByText(/invalid, has already been used, or was revoked/i),
      ).toBeInTheDocument(),
    );
  });

  it("shows a distinct message for an email mismatch, and never leaks org details", async () => {
    acceptInvitationMock.mockRejectedValue(
      new ArieApiError("this invitation was sent to a different email address", 403),
    );
    render(<InviteAcceptView token="mismatch-token" />);
    await waitFor(() =>
      expect(screen.getByText(/different email address/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/organization_id|org-1/i)).not.toBeInTheDocument();
  });
});
