"use client";

import { useEffect, useState } from "react";
import { CircleAlert, Pencil } from "lucide-react";
import { getOrganization, updateOrganization } from "@/lib/api/organization";
import { ArieApiError } from "@/lib/api/errors";
import type { OrganizationResponse } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { Panel, Eyebrow, PanelHeader } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export function OrganizationDetailsPanel({ canEdit }: { canEdit: boolean }) {
  const [org, setOrg] = useState<OrganizationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getOrganization()
      .then((result) => {
        if (!cancelled) setOrg(result);
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

  if (loading) {
    return (
      <Panel padding="lg">
        <p className="text-sm text-text-faint">Loading organization settings…</p>
      </Panel>
    );
  }

  if (loadError || !org) {
    return (
      <Panel padding="lg" accent="reject">
        <p className="flex items-center gap-2 text-sm text-text">
          <CircleAlert aria-hidden className="h-4 w-4 shrink-0 text-reject" strokeWidth={2.25} />
          {loadError ?? "Could not load organization settings."}
        </p>
      </Panel>
    );
  }

  if (editing) {
    return (
      <EditOrganizationForm
        org={org}
        onCancel={() => setEditing(false)}
        onSaved={(updated) => {
          setOrg(updated);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <Panel padding="lg" accent="machine">
      <PanelHeader
        eyebrow="Organization"
        title={org.name}
        trailing={
          canEdit ? (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" strokeWidth={2.25} />
              Edit
            </Button>
          ) : (
            <Badge tone="neutral" size="sm">
              Read-only
            </Badge>
          )
        }
      />
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Slug" value={org.slug} />
        <Field label="Status" value={org.status} />
        <Field label="Timezone" value={org.timezone} />
        <Field label="Company domain" value={org.company_domain ?? "Not set"} />
        <Field
          label="Onboarding"
          value={org.onboarding_completed_at ? "Completed" : "In progress"}
        />
        <Field label="Created" value={formatDateTime(org.created_at)} />
      </div>
    </Panel>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <p className="t-data mt-1 text-sm text-text">{value}</p>
    </div>
  );
}

function EditOrganizationForm({
  org,
  onCancel,
  onSaved,
}: {
  org: OrganizationResponse;
  onCancel: () => void;
  onSaved: (updated: OrganizationResponse) => void;
}) {
  const [name, setName] = useState(org.name);
  const [timezone, setTimezone] = useState(org.timezone);
  const [companyDomain, setCompanyDomain] = useState(org.company_domain ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const updated = await updateOrganization({
        name: name.trim() !== org.name ? name.trim() : undefined,
        timezone: timezone.trim() !== org.timezone ? timezone.trim() : undefined,
        company_domain:
          companyDomain.trim() !== (org.company_domain ?? "")
            ? companyDomain.trim() || null
            : undefined,
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof ArieApiError ? err.message : err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel padding="lg" accent="human">
      <form onSubmit={handleSubmit} className="grid gap-5">
        <div>
          <Eyebrow>Organization</Eyebrow>
          <h2 className="t-h3 mt-1.5 text-text">Edit organization settings</h2>
        </div>

        <Field2 label="Name" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="input"
          />
        </Field2>

        <Field2 label="Timezone (IANA, e.g. America/New_York)">
          <input
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="America/New_York"
            className="input"
          />
        </Field2>

        <Field2 label="Company domain">
          <input
            value={companyDomain}
            onChange={(e) => setCompanyDomain(e.target.value)}
            placeholder="acme.example"
            className="input"
          />
        </Field2>

        {error && (
          <p className="flex items-center gap-2 rounded-md border border-reject-edge bg-reject-dim px-3 py-2 text-sm text-text">
            <CircleAlert aria-hidden className="h-4 w-4 shrink-0 text-reject" strokeWidth={2.25} />
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 border-t border-border pt-5">
          <Button type="submit" variant="human" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function Field2({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-text-dim">
        {label}
        {required && (
          <span className="text-human" aria-hidden>
            {" "}
            *
          </span>
        )}
      </span>
      {children}
    </label>
  );
}
