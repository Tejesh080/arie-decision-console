"use client";

import { useEffect, useState } from "react";
import { CircleAlert, Mail, X } from "lucide-react";
import {
  createInvitation,
  listInvitations,
  resendInvitation,
  revokeInvitation,
} from "@/lib/api/invitations";
import { ArieApiError } from "@/lib/api/errors";
import { ROLES, type InvitationCreatedResponse, type InvitationResponse } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";

const STATUS_TONE: Record<InvitationResponse["status"], BadgeTone> = {
  pending: "human",
  accepted: "qualify",
  revoked: "neutral",
  expired: "reject",
};

function inviteLink(rawToken: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/invite/accept?token=${encodeURIComponent(rawToken)}`;
}

export function InvitationsPanel({ canEdit }: { canEdit: boolean }) {
  const [invitations, setInvitations] = useState<InvitationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("analyst_reviewer");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<InvitationCreatedResponse | null>(null);

  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      setInvitations(await listInvitations());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const created = await createInvitation({ email: email.trim(), role });
      setJustCreated(created);
      setEmail("");
      await load();
    } catch (err) {
      setCreateError(err instanceof ArieApiError ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(invitationId: string) {
    setRevokingId(invitationId);
    setRowError(null);
    try {
      await revokeInvitation(invitationId);
      setInvitations((prev) =>
        prev.map((i) => (i.invitation_id === invitationId ? { ...i, status: "revoked" } : i)),
      );
    } catch (err) {
      setRowError(err instanceof ArieApiError ? err.message : String(err));
    } finally {
      setRevokingId(null);
    }
  }

  async function handleResend(invitationId: string) {
    setResendingId(invitationId);
    setRowError(null);
    try {
      const reissued = await resendInvitation(invitationId);
      setJustCreated(reissued);
      await load();
    } catch (err) {
      setRowError(err instanceof ArieApiError ? err.message : String(err));
    } finally {
      setResendingId(null);
    }
  }

  const pending = invitations.filter((i) => i.status === "pending");
  const resolved = invitations.filter((i) => i.status !== "pending");

  return (
    <Panel padding="lg" className="mt-6">
      <PanelHeader
        eyebrow="Invitations"
        title="Invite members"
        trailing={
          !canEdit && (
            <Badge tone="neutral" size="sm">
              Read-only
            </Badge>
          )
        }
      />

      <p className="mt-2 text-xs text-text-faint">
        An invitation email is sent automatically. The link below is also shown once as a backup —
        useful if delivery fails or you&apos;d rather share it directly.
      </p>

      {canEdit && (
        <form onSubmit={handleCreate} className="mt-5 flex flex-wrap items-end gap-3">
          <label className="flex flex-1 min-w-[200px] flex-col gap-1.5">
            <span className="text-xs font-medium text-text-dim">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@company.com"
              className="input"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-dim">Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="select">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="primary" disabled={creating}>
            <Mail className="h-4 w-4" strokeWidth={2.25} />
            {creating ? "Sending…" : "Create invitation"}
          </Button>
        </form>
      )}

      {createError && (
        <p className="mt-3 flex items-center gap-2 text-sm text-reject">
          <CircleAlert aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2.25} />
          {createError}
        </p>
      )}

      {justCreated && (
        <div className="mt-4 rounded-md border border-human-edge bg-human-dim px-3 py-3">
          <p className="text-xs font-medium text-human">
            Invitation created for {justCreated.email_normalized}. Copy this link now — it will not
            be shown again.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="t-data flex-1 truncate rounded bg-bg-sunken px-2 py-1.5 text-xs text-text">
              {inviteLink(justCreated.raw_token)}
            </code>
            <CopyButton value={inviteLink(justCreated.raw_token)} label="Copy invite link" />
          </div>
          <button
            type="button"
            onClick={() => setJustCreated(null)}
            className="mt-2 text-xs text-text-faint hover:text-text-dim"
          >
            Dismiss
          </button>
        </div>
      )}

      {loadError && <p className="mt-4 text-sm text-reject">{loadError}</p>}
      {rowError && <p className="mt-2 text-sm text-reject">{rowError}</p>}

      {loading ? (
        <p className="mt-4 text-sm text-text-faint">Loading invitations…</p>
      ) : (
        <>
          <div className="mt-5">
            <p className="text-xs font-medium text-text-dim">Pending</p>
            {pending.length === 0 ? (
              <p className="mt-2 text-xs text-text-faint">No pending invitations.</p>
            ) : (
              <ul className="mt-2 flex flex-col divide-y divide-border">
                {pending.map((invitation) => (
                  <li
                    key={invitation.invitation_id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-text">{invitation.email_normalized}</p>
                      <p className="t-data mt-0.5 text-xs text-text-faint">
                        {invitation.role} · expires {formatDateTime(invitation.expires_at)}
                        {invitation.email_status === "failed" && " · email delivery failed"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={STATUS_TONE[invitation.status]} size="sm">
                        {invitation.status}
                      </Badge>
                      {canEdit && invitation.email_status === "failed" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={resendingId === invitation.invitation_id}
                          onClick={() => handleResend(invitation.invitation_id)}
                        >
                          {resendingId === invitation.invitation_id ? "Resending…" : "Resend"}
                        </Button>
                      )}
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={revokingId === invitation.invitation_id}
                          onClick={() => handleRevoke(invitation.invitation_id)}
                          aria-label={`Revoke invitation for ${invitation.email_normalized}`}
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={2.25} />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {resolved.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-medium text-text-dim">History</p>
              <ul className="mt-2 flex flex-col divide-y divide-border">
                {resolved.map((invitation) => (
                  <li
                    key={invitation.invitation_id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-text-dim">
                        {invitation.email_normalized}
                      </p>
                      <p className="t-data mt-0.5 text-xs text-text-faint">{invitation.role}</p>
                    </div>
                    <Badge tone={STATUS_TONE[invitation.status]} size="sm">
                      {invitation.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
