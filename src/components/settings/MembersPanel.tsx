"use client";

import { useEffect, useState } from "react";
import { CircleAlert, UserX } from "lucide-react";
import { listMembers, removeMember, updateMemberRole } from "@/lib/api/members";
import { ArieApiError } from "@/lib/api/errors";
import { ROLES, type MemberResponse } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export function MembersPanel({
  canEdit,
  currentUserId,
}: {
  canEdit: boolean;
  currentUserId: string | null;
}) {
  const [members, setMembers] = useState<MemberResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [confirmRemoveUserId, setConfirmRemoveUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMembers()
      .then((result) => {
        if (!cancelled) setMembers(result);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function setError(userId: string, message: string | null) {
    setRowError((prev) => {
      const next = { ...prev };
      if (message) next[userId] = message;
      else delete next[userId];
      return next;
    });
  }

  async function handleRoleChange(userId: string, role: string) {
    setPendingUserId(userId);
    setError(userId, null);
    try {
      const updated = await updateMemberRole(userId, { role });
      setMembers((prev) => prev.map((m) => (m.user_id === userId ? updated : m)));
    } catch (err) {
      setError(userId, err instanceof ArieApiError ? err.message : String(err));
    } finally {
      setPendingUserId(null);
    }
  }

  async function handleRemove(userId: string) {
    if (confirmRemoveUserId !== userId) {
      setConfirmRemoveUserId(userId);
      return;
    }
    setPendingUserId(userId);
    setError(userId, null);
    try {
      await removeMember(userId);
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    } catch (err) {
      setError(userId, err instanceof ArieApiError ? err.message : String(err));
    } finally {
      setPendingUserId(null);
      setConfirmRemoveUserId(null);
    }
  }

  return (
    <Panel padding="lg" className="mt-6">
      <PanelHeader
        eyebrow="Members"
        title="Organization members"
        trailing={!canEdit && <Badge tone="neutral" size="sm">Read-only</Badge>}
      />

      {loadError && (
        <p className="mt-4 flex items-center gap-2 text-sm text-reject">
          <CircleAlert aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2.25} />
          {loadError}
        </p>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-text-faint">Loading members…</p>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-border">
          {members.map((member) => {
            const isSelf = currentUserId !== null && member.user_id === currentUserId;
            const busy = pendingUserId === member.user_id;
            return (
              <li key={member.user_id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="t-data truncate text-sm text-text">
                      {member.user_id}
                      {isSelf && <span className="ml-2 text-xs text-text-faint">(you)</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-text-faint">
                      Joined {formatDateTime(member.created_at)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {canEdit ? (
                      <select
                        value={member.role}
                        disabled={isSelf || busy}
                        onChange={(e) => handleRoleChange(member.user_id, e.target.value)}
                        className="select"
                        aria-label={`Role for ${member.user_id}`}
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Badge tone="neutral" size="sm">
                        {member.role}
                      </Badge>
                    )}

                    {canEdit && (
                      <Button
                        variant={confirmRemoveUserId === member.user_id ? "danger" : "ghost"}
                        size="sm"
                        disabled={isSelf || busy}
                        onClick={() => handleRemove(member.user_id)}
                        onBlur={() =>
                          setConfirmRemoveUserId((prev) =>
                            prev === member.user_id ? null : prev,
                          )
                        }
                      >
                        <UserX className="h-3.5 w-3.5" strokeWidth={2.25} />
                        {confirmRemoveUserId === member.user_id ? "Confirm remove" : "Remove"}
                      </Button>
                    )}
                  </div>
                </div>

                {rowError[member.user_id] && (
                  <p className="mt-2 flex items-center gap-2 text-xs text-reject">
                    <CircleAlert aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
                    {rowError[member.user_id]}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
