import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MembersPanel } from "./MembersPanel";
import { ArieApiError } from "@/lib/api/errors";
import type { MemberResponse } from "@/lib/api/types";

const { listMembersMock, updateMemberRoleMock, removeMemberMock } = vi.hoisted(() => ({
  listMembersMock: vi.fn(),
  updateMemberRoleMock: vi.fn(),
  removeMemberMock: vi.fn(),
}));
vi.mock("@/lib/api/members", () => ({
  listMembers: listMembersMock,
  updateMemberRole: updateMemberRoleMock,
  removeMember: removeMemberMock,
}));

function makeMember(overrides: Partial<MemberResponse> = {}): MemberResponse {
  return {
    organization_id: "org-1",
    user_id: "user-2",
    role: "analyst_reviewer",
    status: "active",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("MembersPanel", () => {
  beforeEach(() => {
    listMembersMock.mockReset();
    updateMemberRoleMock.mockReset();
    removeMemberMock.mockReset();
  });

  it("lists members, marking the current user", async () => {
    listMembersMock.mockResolvedValue([
      makeMember({ user_id: "self-1", role: "owner" }),
      makeMember({ user_id: "user-2", role: "analyst_reviewer" }),
    ]);
    render(<MembersPanel canEdit={true} currentUserId="self-1" />);
    await waitFor(() => expect(screen.getByText("self-1")).toBeInTheDocument());
    expect(screen.getByText("(you)")).toBeInTheDocument();
  });

  it("renders roles read-only for a non-admin", async () => {
    listMembersMock.mockResolvedValue([makeMember()]);
    render(<MembersPanel canEdit={false} currentUserId={null} />);
    await waitFor(() => expect(screen.getByText("user-2")).toBeInTheDocument());
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
  });

  it("changes a member's role", async () => {
    const user = userEvent.setup();
    listMembersMock.mockResolvedValue([makeMember({ role: "analyst_reviewer" })]);
    updateMemberRoleMock.mockResolvedValue(makeMember({ role: "admin" }));

    render(<MembersPanel canEdit={true} currentUserId="self-1" />);
    await waitFor(() => expect(screen.getByText("user-2")).toBeInTheDocument());

    await user.selectOptions(screen.getByRole("combobox"), "admin");
    await waitFor(() =>
      expect(updateMemberRoleMock).toHaveBeenCalledWith("user-2", { role: "admin" }),
    );
  });

  it("requires a second confirming click before removing a member", async () => {
    const user = userEvent.setup();
    listMembersMock.mockResolvedValue([makeMember()]);
    removeMemberMock.mockResolvedValue(makeMember());

    render(<MembersPanel canEdit={true} currentUserId="self-1" />);
    await waitFor(() => expect(screen.getByText("user-2")).toBeInTheDocument());

    const removeButton = screen.getByRole("button", { name: /remove/i });
    await user.click(removeButton);
    expect(removeMemberMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /confirm remove/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /confirm remove/i }));
    await waitFor(() => expect(removeMemberMock).toHaveBeenCalledWith("user-2"));
    await waitFor(() => expect(screen.queryByText("user-2")).not.toBeInTheDocument());
  });

  it("disables role and remove controls for the current user", async () => {
    listMembersMock.mockResolvedValue([makeMember({ user_id: "self-1", role: "owner" })]);
    render(<MembersPanel canEdit={true} currentUserId="self-1" />);
    await waitFor(() => expect(screen.getByText("self-1")).toBeInTheDocument());
    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(screen.getByRole("button", { name: /remove/i })).toBeDisabled();
  });

  it("renders the backend's last-owner protection error inline", async () => {
    const user = userEvent.setup();
    listMembersMock.mockResolvedValue([makeMember({ role: "owner" })]);
    updateMemberRoleMock.mockRejectedValue(
      new ArieApiError("cannot demote the organization's only remaining owner", 409),
    );

    render(<MembersPanel canEdit={true} currentUserId="self-1" />);
    await waitFor(() => expect(screen.getByText("user-2")).toBeInTheDocument());

    await user.selectOptions(screen.getByRole("combobox"), "admin");
    await waitFor(() =>
      expect(
        screen.getByText("cannot demote the organization's only remaining owner"),
      ).toBeInTheDocument(),
    );
  });
});
