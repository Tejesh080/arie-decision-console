"use client";

import { useState } from "react";
import { CircleAlert, CircleCheck, KeyRound, Trash2 } from "lucide-react";
import {
  removeProviderCredential,
  setProviderCredential,
  setProviderEnabled,
  testProviderConnection,
} from "@/lib/api/providers";
import { ArieApiError } from "@/lib/api/errors";
import { PROVIDER_DISPLAY_NAMES, type ProviderId, type ProviderStatusResponse } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

/**
 * Owns the credential textbox's whole lifecycle. The raw value never leaves
 * this component except as the one outbound `setProviderCredential` call —
 * it is never logged, never rendered back, and is cleared from state in a
 * `finally` block regardless of whether the save succeeded, so it never
 * outlives the request that needed it.
 */
export function ProviderCard({
  status,
  canEdit,
  onChanged,
}: {
  status: ProviderStatusResponse;
  canEdit: boolean;
  onChanged: (next: ProviderStatusResponse) => void;
}) {
  const provider = status.provider as ProviderId;
  const displayName = PROVIDER_DISPLAY_NAMES[provider] ?? status.provider;

  const [editingCredential, setEditingCredential] = useState(false);
  const [credential, setCredentialInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleSaveCredential(event: React.FormEvent) {
    event.preventDefault();
    setActionError(null);
    setSaving(true);
    try {
      const updated = await setProviderCredential(provider, { credential });
      onChanged(updated);
      setEditingCredential(false);
    } catch (err) {
      setActionError(err instanceof ArieApiError ? err.message : String(err));
    } finally {
      // Cleared unconditionally — see this component's docstring.
      setCredentialInput("");
      setSaving(false);
    }
  }

  async function handleToggleEnabled() {
    setActionError(null);
    try {
      const updated = await setProviderEnabled(provider, { enabled: !status.enabled });
      onChanged(updated);
    } catch (err) {
      setActionError(err instanceof ArieApiError ? err.message : String(err));
    }
  }

  async function handleRemove() {
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    setActionError(null);
    setRemoving(true);
    try {
      await removeProviderCredential(provider);
      onChanged({
        provider,
        configured: false,
        enabled: false,
        updated_at: null,
        last_tested_at: null,
        last_test_status: null,
        last_test_error: null,
      });
    } catch (err) {
      setActionError(err instanceof ArieApiError ? err.message : String(err));
    } finally {
      setRemoving(false);
      setConfirmRemove(false);
    }
  }

  async function handleTest() {
    setActionError(null);
    setTesting(true);
    try {
      const updated = await testProviderConnection(provider);
      onChanged(updated);
    } catch (err) {
      setActionError(err instanceof ArieApiError ? err.message : String(err));
    } finally {
      setTesting(false);
    }
  }

  return (
    <Panel padding="lg" accent={status.configured ? "machine" : undefined}>
      <PanelHeader
        eyebrow="Provider"
        title={displayName}
        trailing={
          status.configured ? (
            <Badge tone={status.enabled ? "qualify" : "neutral"} size="sm">
              {status.enabled ? "Enabled" : "Disabled"}
            </Badge>
          ) : (
            <Badge tone="neutral" size="sm">
              Not configured
            </Badge>
          )
        }
      />

      <div className="mt-4 grid gap-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-text-dim">Credential</span>
          <span className="t-data text-text">
            {status.configured ? "Credential configured" : "No credential set"}
          </span>
        </div>
        {status.updated_at && (
          <div className="flex items-center justify-between">
            <span className="text-text-dim">Last updated</span>
            <span className="t-data text-text-faint">{formatDateTime(status.updated_at)}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-text-dim">Last connection test</span>
          <span className="flex items-center gap-1.5">
            {status.last_test_status === "success" && (
              <CircleCheck className="h-3.5 w-3.5 text-qualify" strokeWidth={2.25} />
            )}
            {status.last_test_status === "failure" && (
              <CircleAlert className="h-3.5 w-3.5 text-reject" strokeWidth={2.25} />
            )}
            <span className="t-data text-text-faint">
              {status.last_tested_at ? formatDateTime(status.last_tested_at) : "Never tested"}
            </span>
          </span>
        </div>
        {status.last_test_status === "failure" && status.last_test_error && (
          <p className="t-data rounded-md border border-reject-edge bg-reject-dim px-2.5 py-1.5 text-xs text-reject">
            {status.last_test_error}
          </p>
        )}
      </div>

      {actionError && (
        <p className="mt-3 flex items-center gap-2 text-xs text-reject">
          <CircleAlert aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
          {actionError}
        </p>
      )}

      {canEdit && editingCredential && (
        <form onSubmit={handleSaveCredential} className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-dim">
              {status.configured ? "Replacement API key" : "API key"}
            </span>
            <input
              type="password"
              autoComplete="off"
              value={credential}
              onChange={(e) => setCredentialInput(e.target.value)}
              required
              className="input"
              placeholder="Paste the provider API key"
            />
          </label>
          <div className="flex items-center gap-2">
            <Button type="submit" variant="primary" size="sm" disabled={saving || !credential}>
              {saving ? "Saving…" : "Save credential"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={() => {
                setEditingCredential(false);
                setCredentialInput("");
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {canEdit && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          {!editingCredential && (
            <Button variant="secondary" size="sm" onClick={() => setEditingCredential(true)}>
              <KeyRound className="h-3.5 w-3.5" strokeWidth={2.25} />
              {status.configured ? "Replace credential" : "Enter API key"}
            </Button>
          )}
          {status.configured && (
            <>
              <Button variant="secondary" size="sm" onClick={handleToggleEnabled}>
                {status.enabled ? "Disable" : "Enable"}
              </Button>
              <Button variant="secondary" size="sm" disabled={testing} onClick={handleTest}>
                {testing ? "Testing…" : "Test connection"}
              </Button>
              <Button
                variant={confirmRemove ? "danger" : "ghost"}
                size="sm"
                disabled={removing}
                onClick={handleRemove}
                onBlur={() => setConfirmRemove(false)}
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                {confirmRemove ? "Confirm remove" : "Remove"}
              </Button>
            </>
          )}
        </div>
      )}
    </Panel>
  );
}
