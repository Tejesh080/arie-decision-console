import { getDataMode } from "@/lib/api/mode";
import { resolveAuthContext } from "@/lib/auth/context";
import { ProvidersView } from "@/components/providers/ProvidersView";

/** Same courtesy-gate shape as `ICPPage`/`SettingsPage` — the backend
 * independently enforces owner/admin on every write route. */
export default async function ProvidersPage() {
  let canEdit = true;
  if (getDataMode() === "api") {
    const auth = await resolveAuthContext();
    canEdit = auth.state === "authorized" && (auth.role === "owner" || auth.role === "admin");
  }
  return <ProvidersView canEdit={canEdit} />;
}
