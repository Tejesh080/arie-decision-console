import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateOrganizationForm } from "./CreateOrganizationForm";
import { ArieApiError, ArieEntitlementError } from "@/lib/api/errors";

const { createOrganizationMock } = vi.hoisted(() => ({ createOrganizationMock: vi.fn() }));
vi.mock("@/lib/api/organizations", () => ({ createOrganization: createOrganizationMock }));

const assignMock = vi.fn();

describe("CreateOrganizationForm", () => {
  beforeEach(() => {
    createOrganizationMock.mockReset();
    assignMock.mockReset();
    vi.stubGlobal("location", { origin: "https://console.example", assign: assignMock });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("provisions the organization and reloads so the new session is seen", async () => {
    // The backend creates organization + owner membership + billing row in
    // one transaction, so the caller is an owner the instant this resolves.
    // A full navigation is what makes resolveAuthContext observe that on the
    // next request — a client-side route change would render the same
    // "no organization" screen again.
    createOrganizationMock.mockResolvedValue({ organization_id: "org-1", slug: "acme-inc" });
    render(<CreateOrganizationForm />);

    await userEvent.type(screen.getByLabelText(/organization name/i), "Acme Inc.");
    await userEvent.click(screen.getByRole("button", { name: /create organization/i }));

    await waitFor(() => expect(createOrganizationMock).toHaveBeenCalledWith({ name: "Acme Inc." }));
    await waitFor(() => expect(assignMock).toHaveBeenCalledWith("/"));
  });

  it("trims the name before sending it", async () => {
    // The backend slugifies whatever it is given; sending " Acme " would
    // store a name with edges no one typed on purpose.
    createOrganizationMock.mockResolvedValue({ organization_id: "org-1", slug: "acme" });
    render(<CreateOrganizationForm />);

    await userEvent.type(screen.getByLabelText(/organization name/i), "   Acme   ");
    await userEvent.click(screen.getByRole("button", { name: /create organization/i }));

    await waitFor(() => expect(createOrganizationMock).toHaveBeenCalledWith({ name: "Acme" }));
  });

  it("cannot be submitted with a blank or whitespace-only name", async () => {
    render(<CreateOrganizationForm />);
    const submit = screen.getByRole("button", { name: /create organization/i });
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/organization name/i), "    ");

    expect(submit).toBeDisabled();
    expect(createOrganizationMock).not.toHaveBeenCalled();
  });

  it("shows the backend's refusal and stays on the form", async () => {
    createOrganizationMock.mockRejectedValue(
      new ArieApiError("Verification failed. Please try again.", 400),
    );
    render(<CreateOrganizationForm />);

    await userEvent.type(screen.getByLabelText(/organization name/i), "Acme Inc.");
    await userEvent.click(screen.getByRole("button", { name: /create organization/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Verification failed. Please try again."),
    );
    expect(assignMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /create organization/i })).toBeEnabled();
  });

  it("surfaces a 402 the same way, pointing at the real reason", async () => {
    createOrganizationMock.mockRejectedValue(
      new ArieEntitlementError("This account already owns an organization."),
    );
    render(<CreateOrganizationForm />);

    await userEvent.type(screen.getByLabelText(/organization name/i), "Second Org");
    await userEvent.click(screen.getByRole("button", { name: /create organization/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "This account already owns an organization.",
      ),
    );
  });

  it("disables the button while the request is in flight", async () => {
    let resolve: (value: unknown) => void = () => {};
    createOrganizationMock.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    render(<CreateOrganizationForm />);

    await userEvent.type(screen.getByLabelText(/organization name/i), "Acme Inc.");
    await userEvent.click(screen.getByRole("button", { name: /create organization/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: /creating/i })).toBeDisabled());
    resolve({ organization_id: "org-1", slug: "acme-inc" });
    await waitFor(() => expect(assignMock).toHaveBeenCalled());
    // One organization, not one per impatient click.
    expect(createOrganizationMock).toHaveBeenCalledOnce();
  });
});
