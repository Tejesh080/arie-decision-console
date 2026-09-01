import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignupView } from "./SignupView";

const { signUpMock } = vi.hoisted(() => ({ signUpMock: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signUp: signUpMock } }),
}));

const assignMock = vi.fn();

async function fillAndSubmit(email = "founder@example.com", password = "correct-horse") {
  await userEvent.type(screen.getByLabelText("Email"), email);
  await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.click(screen.getByRole("button", { name: /create account/i }));
}

describe("SignupView", () => {
  beforeEach(() => {
    signUpMock.mockReset();
    assignMock.mockReset();
    vi.stubGlobal("location", { origin: "https://console.example", assign: assignMock });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("registers the account against Supabase Auth, not the ARIE backend", async () => {
    // Signup is deliberately not an ARIE endpoint: the backend only ever sees
    // an *already-verified* identity (POST /organizations takes a verified
    // Supabase JWT). If this ever started calling the API directly, the
    // backend would have to own password handling, which it must not.
    signUpMock.mockResolvedValue({ data: { session: null }, error: null });
    render(<SignupView />);

    await fillAndSubmit();

    await waitFor(() => expect(signUpMock).toHaveBeenCalledOnce());
    expect(signUpMock).toHaveBeenCalledWith({
      email: "founder@example.com",
      password: "correct-horse",
      options: { emailRedirectTo: "https://console.example/login" },
    });
  });

  it("tells the user to check their email when no session is issued", async () => {
    // The safer, common Supabase default: email confirmation required, so no
    // session exists yet and there is nothing to navigate to.
    signUpMock.mockResolvedValue({ data: { session: null }, error: null });
    render(<SignupView />);

    await fillAndSubmit();

    await waitFor(() => expect(screen.getByText(/check your email/i)).toBeInTheDocument());
    expect(screen.getByText(/founder@example.com/)).toBeInTheDocument();
    expect(assignMock).not.toHaveBeenCalled();
  });

  it("navigates in full when a session is issued immediately", async () => {
    // Email confirmation disabled on the project. A full navigation (not a
    // client-side route change) is what makes middleware and
    // resolveAuthContext see the new cookie on the very next request.
    signUpMock.mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });
    render(<SignupView />);

    await fillAndSubmit();

    await waitFor(() => expect(assignMock).toHaveBeenCalledWith("/"));
  });

  it("shows Supabase's own error and lets the user try again", async () => {
    signUpMock.mockResolvedValue({
      data: { session: null },
      error: { message: "User already registered" },
    });
    render(<SignupView />);

    await fillAndSubmit();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("User already registered"),
    );
    expect(screen.getByRole("button", { name: /create account/i })).toBeEnabled();
    expect(screen.queryByText(/check your email/i)).not.toBeInTheDocument();
  });

  it("does not offer to create an organization before an identity exists", async () => {
    // Two separate steps on purpose: this page produces a verified identity,
    // and CreateOrganizationForm (behind NoOrganizationAccess) provisions the
    // organization once one exists. Collapsing them would mean provisioning
    // an organization for an unverified email address.
    render(<SignupView />);

    expect(screen.queryByLabelText(/organization name/i)).not.toBeInTheDocument();
  });

  it("requires a password Supabase will accept", async () => {
    render(<SignupView />);

    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("minLength", "8");
    expect(password).toBeRequired();
  });

  it("offers a route back to sign in for someone who already has an account", async () => {
    render(<SignupView />);

    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  });
});
