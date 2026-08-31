import { getDataMode } from "@/lib/api/mode";
import { resolveAuthContext } from "@/lib/auth/context";
import { OrganizationDetailsPanel } from "@/components/settings/OrganizationDetailsPanel";
import { MembersPanel } from "@/components/settings/MembersPanel";
import { InvitationsPanel } from "@/components/settings/InvitationsPanel";
import { Eyebrow } from "@/components/ui/Panel";

/**
 * Thin server wrapper, same shape as `ICPPage` — resolves `canEdit`
 * (owner/admin) once and passes it to every section below as a UI courtesy.
 * The backend independently re-derives owner/admin on every write
 * (`_require_org_admin`), so this is never the real gate.
 */
export default async function SettingsPage() {
  let canEdit = true;
  let currentUserId: string | null = null;
  if (getDataMode() === "api") {
    const auth = await resolveAuthContext();
    canEdit = auth.state === "authorized" && (auth.role === "owner" || auth.role === "admin");
    currentUserId = auth.state === "authorized" ? auth.userId : null;
  }

  return (
    <div className="mx-auto max-w-[900px] px-5 py-10 sm:px-8">
      <header className="mb-8">
        <Eyebrow>Settings</Eyebrow>
        <h1 className="t-h1 mt-2 text-text">Organization settings</h1>
        <p className="mt-3 max-w-2xl text-[0.9375rem] leading-relaxed text-text-dim">
          Organization details, membership, and pending invitations.
        </p>
      </header>

      <OrganizationDetailsPanel canEdit={canEdit} />
      <MembersPanel canEdit={canEdit} currentUserId={currentUserId} />
      <InvitationsPanel canEdit={canEdit} />
    </div>
  );
}
