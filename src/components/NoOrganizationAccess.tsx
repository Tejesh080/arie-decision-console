import { Mark } from "@/components/brand/Mark";
import { Eyebrow, Panel } from "@/components/ui/Panel";
import { SignOutButton } from "@/components/SignOutButton";

/**
 * Signed in, but no active `organization_members` row for this user. Not an
 * error state — a real Supabase identity with nothing provisioned yet, so
 * this says exactly that rather than a generic "access denied" that would
 * read like a bug.
 */
export function NoOrganizationAccess() {
  return (
    <main id="content" className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-5">
      <Panel padding="lg" className="max-w-md text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-bg-sunken">
          <Mark className="h-6 w-6 text-text-faint" crossed={false} />
        </div>
        <Eyebrow className="mt-5">No organization access</Eyebrow>
        <h1 className="t-h3 mt-2 text-text">You&apos;re signed in, but not a member of an organization yet.</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-dim">
          An ARIE organization owner or admin needs to add your account before you can see any
          leads or decisions.
        </p>
        <div className="mt-6 flex justify-center">
          <SignOutButton />
        </div>
      </Panel>
    </main>
  );
}
