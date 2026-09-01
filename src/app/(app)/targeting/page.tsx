import { getDataMode } from "@/lib/api/mode";
import { resolveAuthContext } from "@/lib/auth/context";
import { TargetingSetupView } from "@/components/targeting/TargetingSetupView";

/**
 * The plain-English way to configure targeting. `/icp` still serves the direct
 * six-weight editor for anyone who wants it; this is the path that does not
 * require understanding the six weights at all.
 *
 * `canEdit` mirrors `/icp`'s wrapper exactly, and for the same reason: it is a
 * courtesy the UI acts on, not the real gate. Both targeting endpoints enforce
 * owner/admin server-side regardless of what this page decided to render.
 */
export default async function TargetingPage() {
  let canEdit = true;
  if (getDataMode() === "api") {
    const auth = await resolveAuthContext();
    canEdit = auth.state === "authorized" && (auth.role === "owner" || auth.role === "admin");
  }
  return <TargetingSetupView canEdit={canEdit} />;
}
