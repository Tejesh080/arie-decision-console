import { useState } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProviderCard } from "./ProviderCard";
import { ArieApiError } from "@/lib/api/errors";
import type { ProviderStatusResponse } from "@/lib/api/types";

const {
  setProviderCredentialMock,
  setProviderEnabledMock,
  removeProviderCredentialMock,
  testProviderConnectionMock,
} = vi.hoisted(() => ({
  setProviderCredentialMock: vi.fn(),
  setProviderEnabledMock: vi.fn(),
  removeProviderCredentialMock: vi.fn(),
  testProviderConnectionMock: vi.fn(),
}));
vi.mock("@/lib/api/providers", () => ({
  setProviderCredential: setProviderCredentialMock,
  setProviderEnabled: setProviderEnabledMock,
  removeProviderCredential: removeProviderCredentialMock,
  testProviderConnection: testProviderConnectionMock,
}));

function makeStatus(overrides: Partial<ProviderStatusResponse> = {}): ProviderStatusResponse {
  return {
    provider: "hunter_combined_enrichment",
    configured: false,
    enabled: false,
    updated_at: null,
    last_tested_at: null,
    last_test_status: null,
    last_test_error: null,
    ...overrides,
  };
}

/** `ProviderCard` is stateless about `status` — the real `ProvidersView`
 * re-renders it with the server's response after `onChanged`. This mirrors
 * that so a test can assert on the post-update UI, not just the call. */
function StatefulCard({ initial, canEdit }: { initial: ProviderStatusResponse; canEdit: boolean }) {
  const [status, setStatus] = useState(initial);
  return <ProviderCard status={status} canEdit={canEdit} onChanged={setStatus} />;
}

describe("ProviderCard", () => {
  beforeEach(() => {
    setProviderCredentialMock.mockReset();
    setProviderEnabledMock.mockReset();
    removeProviderCredentialMock.mockReset();
    testProviderConnectionMock.mockReset();
  });

  it("shows 'Not configured' and an entry point for a fresh provider", () => {
    render(<ProviderCard status={makeStatus()} canEdit={true} onChanged={vi.fn()} />);
    expect(screen.getByText("Not configured")).toBeInTheDocument();
    expect(screen.getByText("No credential set")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enter api key/i })).toBeInTheDocument();
  });

  it("never renders a raw credential once configured", () => {
    render(
      <ProviderCard
        status={makeStatus({ configured: true, enabled: true, updated_at: "2026-01-01T00:00:00Z" })}
        canEdit={true}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.getByText("Credential configured")).toBeInTheDocument();
    expect(screen.queryByDisplayValue(/./)).not.toBeInTheDocument();
  });

  it("hides all write controls for a non-admin, read-only member", () => {
    render(
      <ProviderCard
        status={makeStatus({ configured: true, enabled: true })}
        canEdit={false}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /replace credential/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /test connection/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
  });

  it("saves a credential and clears the input from the DOM and React state immediately", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    setProviderCredentialMock.mockResolvedValue(
      makeStatus({ configured: true, enabled: true, updated_at: "2026-01-01T00:00:00Z" }),
    );

    render(<ProviderCard status={makeStatus()} canEdit={true} onChanged={onChanged} />);
    await user.click(screen.getByRole("button", { name: /enter api key/i }));

    const input = screen.getByPlaceholderText(/paste the provider api key/i) as HTMLInputElement;
    expect(input.type).toBe("password");
    await user.type(input, "sk-super-secret-value");
    await user.click(screen.getByRole("button", { name: /save credential/i }));

    await waitFor(() =>
      expect(setProviderCredentialMock).toHaveBeenCalledWith("hunter_combined_enrichment", {
        credential: "sk-super-secret-value",
      }),
    );
    expect(onChanged).toHaveBeenCalledWith(
      expect.objectContaining({ configured: true, enabled: true }),
    );
    // The credential form closes on success and the raw value is gone —
    // never re-rendered anywhere, and no dangling input still holds it.
    await waitFor(() =>
      expect(screen.queryByPlaceholderText(/paste the provider api key/i)).not.toBeInTheDocument(),
    );
    expect(screen.queryByDisplayValue("sk-super-secret-value")).not.toBeInTheDocument();
  });

  it("clears the credential input even when the save fails", async () => {
    const user = userEvent.setup();
    setProviderCredentialMock.mockRejectedValue(new ArieApiError("invalid credential", 422));

    render(<ProviderCard status={makeStatus()} canEdit={true} onChanged={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /enter api key/i }));
    const input = screen.getByPlaceholderText(/paste the provider api key/i) as HTMLInputElement;
    await user.type(input, "sk-will-fail");
    await user.click(screen.getByRole("button", { name: /save credential/i }));

    await waitFor(() => expect(screen.getByText("invalid credential")).toBeInTheDocument());
    // Form is still open (so the admin can retry), but the value is gone.
    expect(
      (screen.getByPlaceholderText(/paste the provider api key/i) as HTMLInputElement).value,
    ).toBe("");
  });

  it("replaces an existing credential via the same never-prepopulated flow", async () => {
    const user = userEvent.setup();
    setProviderCredentialMock.mockResolvedValue(makeStatus({ configured: true, enabled: true }));
    render(
      <ProviderCard
        status={makeStatus({ configured: true, enabled: true })}
        canEdit={true}
        onChanged={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /replace credential/i }));
    const input = screen.getByPlaceholderText(/paste the provider api key/i) as HTMLInputElement;
    expect(input.value).toBe("");
  });

  it("removes a credential after a confirming second click", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    removeProviderCredentialMock.mockResolvedValue(undefined);
    render(
      <ProviderCard
        status={makeStatus({ configured: true, enabled: true })}
        canEdit={true}
        onChanged={onChanged}
      />,
    );
    const removeButton = screen.getByRole("button", { name: /^remove$/i });
    await user.click(removeButton);
    expect(removeProviderCredentialMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /confirm remove/i }));
    await waitFor(() =>
      expect(removeProviderCredentialMock).toHaveBeenCalledWith("hunter_combined_enrichment"),
    );
    expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ configured: false }));
  });

  it("toggles enabled/disabled", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    setProviderEnabledMock.mockResolvedValue(
      makeStatus({ configured: true, enabled: false }),
    );
    render(
      <ProviderCard
        status={makeStatus({ configured: true, enabled: true })}
        canEdit={true}
        onChanged={onChanged}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^disable$/i }));
    await waitFor(() =>
      expect(setProviderEnabledMock).toHaveBeenCalledWith("hunter_combined_enrichment", {
        enabled: false,
      }),
    );
  });

  it("runs a connection test and shows a sanitized failure, never a raw provider response", async () => {
    const user = userEvent.setup();
    testProviderConnectionMock.mockResolvedValue(
      makeStatus({
        configured: true,
        enabled: true,
        last_test_status: "failure",
        last_test_error: "authentication_failed:401",
        last_tested_at: "2026-01-01T00:00:00Z",
      }),
    );
    render(
      <StatefulCard initial={makeStatus({ configured: true, enabled: true })} canEdit={true} />,
    );
    await user.click(screen.getByRole("button", { name: /test connection/i }));
    await waitFor(() =>
      expect(screen.getByText("authentication_failed:401")).toBeInTheDocument(),
    );
  });
});
