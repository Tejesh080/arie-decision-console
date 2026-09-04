import { Mark } from "@/components/brand/Mark";
import { Eyebrow, Panel } from "@/components/ui/Panel";
import { SignOutButton } from "@/components/SignOutButton";
import { CreateOrganizationForm } from "@/components/CreateOrganizationForm";

/**
 * Signed in, but no active `organization_members` row for this user. Not an
 * error state — a real Supabase identity with nothing provisioned yet, so
 * this says exactly that rather than a generic "access denied" that would
 * read like a bug.
 *
 * Productization M6 Part 10/17: offers two ways forward rather than a dead
 * end — self-service provisioning (`CreateOrganizationForm`,
 * `POST /organizations`) alongside the original "wait for an invite" path,
 * which stays true for anyone joining an existing team.
 */
export function NoOrganizationAccess() {
  return (
    <main
      id="content"
      className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-5 py-10"
    >
      <Panel padding="lg" className="w-full max-w-md text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-bg-sunken">
          <Mark className="h-6 w-6 text-text-faint" live={false} />
        </div>
        <Eyebrow className="mt-5">No organization access</Eyebrow>
        <h1 className="t-h3 mt-2 text-text">
          You&apos;re signed in, but not a member of an organization yet.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-text-dim">
          Create your own organization below, or ask an ARIE owner/admin to invite your account to
          theirs.
        </p>

        <CreateOrganizationForm />

        <div className="mt-6 border-t border-border pt-5">
          <SignOutButton />
        </div>
      </Panel>
    </main>
  );
}
