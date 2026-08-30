"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleAlert, Pencil, Plus, Trash2 } from "lucide-react";
import { createICPProfile, getActiveICPProfile, listICPVersions } from "@/lib/api/icp";
import { ArieApiError, ArieNotFoundError, ArieValidationError } from "@/lib/api/errors";
import type { EmployeeCountBand, ICPProfile, ICPProfileConfig } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { Panel, Eyebrow, PanelHeader } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

function cloneConfig(config: ICPProfileConfig): ICPProfileConfig {
  return JSON.parse(JSON.stringify(config)) as ICPProfileConfig;
}

/** The six field ceilings this config's ICP profile validation requires to
 * sum to 100 — mirrors `arie.icp_profiles.validate_config` exactly, for a
 * live "you're at X/100" hint while editing. Not itself a validation: the
 * backend is still the authority on the real submit. */
function ceilingTotal(config: ICPProfileConfig): number {
  const bandMax = Math.max(0, ...config.employee_count_bands.map((b) => b.points));
  const industryMax = Math.max(0, ...Object.values(config.industry_points), 0);
  const seniorityMax = Math.max(0, ...Object.values(config.seniority_points), 0);
  const functionMax = Math.max(0, ...Object.values(config.function_points), 0);
  return (
    bandMax +
    industryMax +
    seniorityMax +
    functionMax +
    config.buying_intent_weight +
    config.trigger_event_weight
  );
}

export function ICPConfigView({ canEdit }: { canEdit: boolean }) {
  const [active, setActive] = useState<ICPProfile | null>(null);
  const [versions, setVersions] = useState<ICPProfile[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [activeProfile, history] = await Promise.all([
        getActiveICPProfile().catch((err) => {
          if (err instanceof ArieNotFoundError) return null;
          throw err;
        }),
        listICPVersions(),
      ]);
      setActive(activeProfile);
      setVersions(history);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="mx-auto max-w-[900px] px-5 py-14 sm:px-8">
        <p className="text-sm text-text-faint">Loading ICP configuration…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[900px] px-5 py-10 sm:px-8">
      <header className="mb-8">
        <Eyebrow>ICP configuration</Eyebrow>
        <h1 className="t-h1 mt-2 text-text">What a good lead means for your organization</h1>
        <p className="mt-3 max-w-2xl text-[0.9375rem] leading-relaxed text-text-dim">
          Field weights, thresholds, and target categories the scorer uses for every new lead.
          Changing this creates a new immutable version — past decisions and their Decision Receipts
          always keep the version that actually produced them.
        </p>
      </header>

      {loadError && (
        <Panel className="mb-6 border-reject-edge" accent="reject">
          <p className="flex items-center gap-2 text-sm text-text">
            <CircleAlert aria-hidden className="h-4 w-4 shrink-0 text-reject" strokeWidth={2.25} />
            {loadError}
          </p>
        </Panel>
      )}

      {!active && !loadError && (
        <Panel className="mb-6">
          <p className="text-sm text-text-dim">
            This organization has no active ICP profile yet — leads score against ARIE&apos;s
            reference configuration until one is created.
          </p>
        </Panel>
      )}

      {active && !editing && (
        <ReadOnlyProfile profile={active} canEdit={canEdit} onEdit={() => setEditing(true)} />
      )}

      {editing && active && (
        <EditProfileForm
          baseConfig={active.config}
          onCancel={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            await load();
          }}
        />
      )}

      {versions.length > 0 && (
        <Panel className="mt-6">
          <Eyebrow>Version history</Eyebrow>
          <ul className="mt-3 flex flex-col divide-y divide-border">
            {versions.map((v) => (
              <li key={v.profile_id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-text">
                    v{v.version} — {v.name}
                  </p>
                  <p className="t-data mt-0.5 text-xs text-text-faint">
                    {formatDateTime(v.activated_at)}
                    {v.retired_at ? ` – ${formatDateTime(v.retired_at)}` : ""}
                  </p>
                </div>
                <Badge tone={v.status === "active" ? "qualify" : "neutral"} size="sm">
                  {v.status}
                </Badge>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function ReadOnlyProfile({
  profile,
  canEdit,
  onEdit,
}: {
  profile: ICPProfile;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const config = profile.config;
  return (
    <Panel accent="machine">
      <PanelHeader
        eyebrow={`Version ${profile.version} — active since ${formatDateTime(profile.activated_at)}`}
        title={profile.name}
        trailing={
          canEdit ? (
            <Button variant="secondary" size="sm" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" strokeWidth={2.25} />
              Create new version
            </Button>
          ) : (
            <Badge tone="neutral" size="sm">
              Read-only
            </Badge>
          )
        }
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <FieldSummary label="Qualify threshold" value={config.qualify_threshold.toString()} />
        <FieldSummary label="Reject threshold" value={config.reject_threshold.toString()} />
        <FieldSummary label="Buying intent weight" value={config.buying_intent_weight.toString()} />
        <FieldSummary label="Trigger event weight" value={config.trigger_event_weight.toString()} />
        <FieldSummary
          label="Hard disqualifier"
          value={config.disqualifier_enabled ? "Enabled" : "Disabled"}
        />
        <FieldSummary
          label="Target geographies (advisory only)"
          value={
            config.target_geographies.length ? config.target_geographies.join(", ") : "None set"
          }
        />
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-3">
        <PointMapSummary title="Industry" points={config.industry_points} />
        <PointMapSummary title="Seniority" points={config.seniority_points} />
        <PointMapSummary title="Function" points={config.function_points} />
      </div>

      <div className="mt-6">
        <p className="text-xs font-medium text-text-dim">Employee count bands</p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {config.employee_count_bands.map((band, i) => (
            <li key={i} className="t-data flex items-center justify-between text-xs text-text-dim">
              <span>
                {band.min_employees}–
                {band.max_employees === 1_000_000_000 ? "∞" : band.max_employees} employees
              </span>
              <span className="text-text">{band.points} pts</span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

function FieldSummary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <p className="t-data mt-1 text-sm text-text">{value}</p>
    </div>
  );
}

function PointMapSummary({ title, points }: { title: string; points: Record<string, number> }) {
  const entries = Object.entries(points);
  return (
    <div>
      <p className="text-xs font-medium text-text-dim">{title}</p>
      <ul className="mt-2 flex flex-col gap-1">
        {entries.length === 0 && <li className="text-xs text-text-faint">None configured</li>}
        {entries.map(([name, pts]) => (
          <li key={name} className="t-data flex items-center justify-between text-xs">
            <span className="text-text-dim">{name}</span>
            <span className="text-text">{pts}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EditProfileForm({
  baseConfig,
  onCancel,
  onSaved,
}: {
  baseConfig: ICPProfileConfig;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [config, setConfig] = useState<ICPProfileConfig>(() => cloneConfig(baseConfig));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = ceilingTotal(config);
  const onTarget = Math.abs(total - 100) < 1e-9;

  function updatePointMap(
    key: "industry_points" | "seniority_points" | "function_points",
    name: string,
    value: number,
  ) {
    setConfig((prev) => ({ ...prev, [key]: { ...prev[key], [name]: value } }));
  }

  function removeFromPointMap(
    key: "industry_points" | "seniority_points" | "function_points",
    name: string,
  ) {
    setConfig((prev) => {
      const next = { ...prev[key] };
      delete next[name];
      return { ...prev, [key]: next };
    });
  }

  function addToPointMap(key: "industry_points" | "seniority_points" | "function_points") {
    const name = window.prompt('New category name (e.g. "consulting")');
    if (!name || !name.trim()) return;
    updatePointMap(key, name.trim(), 0);
  }

  function updateBand(index: number, patch: Partial<EmployeeCountBand>) {
    setConfig((prev) => ({
      ...prev,
      employee_count_bands: prev.employee_count_bands.map((band, i) =>
        i === index ? { ...band, ...patch } : band,
      ),
    }));
  }

  function removeBand(index: number) {
    setConfig((prev) => ({
      ...prev,
      employee_count_bands: prev.employee_count_bands.filter((_, i) => i !== index),
    }));
  }

  function addBand() {
    setConfig((prev) => ({
      ...prev,
      employee_count_bands: [
        ...prev.employee_count_bands,
        { min_employees: 1, max_employees: 10, points: 0 },
      ],
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    try {
      await createICPProfile({ name: name.trim(), config });
      onSaved();
    } catch (err) {
      if (err instanceof ArieValidationError || err instanceof ArieApiError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel accent="human" padding="lg">
      <form onSubmit={handleSubmit} className="grid gap-6">
        <div>
          <Eyebrow>New version</Eyebrow>
          <h2 className="t-h3 mt-1.5 text-text">Create a new configuration version</h2>
          <p className="mt-2 text-sm text-text-dim">
            Saving activates this version immediately — it applies to new leads only. The version
            you&apos;re replacing, and every receipt already produced under it, stays exactly as it
            was.
          </p>
        </div>

        <Field label="Version name" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Q3 tighter ICP"
            required
            className="input"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Qualify threshold">
            <input
              type="number"
              min={0}
              max={100}
              value={config.qualify_threshold}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, qualify_threshold: Number(e.target.value) }))
              }
              className="input"
            />
          </Field>
          <Field label="Reject threshold">
            <input
              type="number"
              min={0}
              max={100}
              value={config.reject_threshold}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, reject_threshold: Number(e.target.value) }))
              }
              className="input"
            />
          </Field>
          <Field label="Buying intent weight">
            <input
              type="number"
              min={0}
              value={config.buying_intent_weight}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, buying_intent_weight: Number(e.target.value) }))
              }
              className="input"
            />
          </Field>
          <Field label="Trigger event weight">
            <input
              type="number"
              min={0}
              value={config.trigger_event_weight}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, trigger_event_weight: Number(e.target.value) }))
              }
              className="input"
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={config.disqualifier_enabled}
            onChange={(e) =>
              setConfig((prev) => ({ ...prev, disqualifier_enabled: e.target.checked }))
            }
          />
          Hard disqualifier enabled (observable data only)
        </label>

        <Field label="Target geographies (advisory only, comma-separated)">
          <input
            value={config.target_geographies.join(", ")}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                target_geographies: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              }))
            }
            placeholder="US, GB, AU"
            className="input"
          />
          <p className="mt-1 text-[0.6875rem] text-text-faint">
            No evidence field supplies geography today — this never affects scoring.
          </p>
        </Field>

        <PointMapEditor
          title="Industry points"
          points={config.industry_points}
          onChange={(name, value) => updatePointMap("industry_points", name, value)}
          onRemove={(name) => removeFromPointMap("industry_points", name)}
          onAdd={() => addToPointMap("industry_points")}
        />
        <PointMapEditor
          title="Seniority points"
          points={config.seniority_points}
          onChange={(name, value) => updatePointMap("seniority_points", name, value)}
          onRemove={(name) => removeFromPointMap("seniority_points", name)}
          onAdd={() => addToPointMap("seniority_points")}
        />
        <PointMapEditor
          title="Function points"
          points={config.function_points}
          onChange={(name, value) => updatePointMap("function_points", name, value)}
          onRemove={(name) => removeFromPointMap("function_points", name)}
          onAdd={() => addToPointMap("function_points")}
        />

        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-dim">Employee count bands</p>
            <button
              type="button"
              onClick={addBand}
              className="flex items-center gap-1 text-xs text-machine hover:underline"
            >
              <Plus className="h-3 w-3" strokeWidth={2.5} />
              Add band
            </button>
          </div>
          <div className="mt-2 flex flex-col gap-2">
            {config.employee_count_bands.map((band, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="number"
                  value={band.min_employees}
                  onChange={(e) => updateBand(i, { min_employees: Number(e.target.value) })}
                  className="input w-24"
                  aria-label="Minimum employees"
                />
                <span className="text-text-faint">–</span>
                <input
                  type="number"
                  value={band.max_employees}
                  onChange={(e) => updateBand(i, { max_employees: Number(e.target.value) })}
                  className="input w-28"
                  aria-label="Maximum employees"
                />
                <input
                  type="number"
                  value={band.points}
                  onChange={(e) => updateBand(i, { points: Number(e.target.value) })}
                  className="input w-20"
                  aria-label="Points"
                />
                <span className="text-xs text-text-faint">pts</span>
                <button
                  type="button"
                  onClick={() => removeBand(i)}
                  className="ml-auto text-text-faint hover:text-reject"
                  aria-label="Remove band"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div
          className={`rounded-md border px-3 py-2 text-xs ${
            onTarget
              ? "border-qualify-edge bg-qualify-dim text-qualify"
              : "border-human-edge bg-human-dim text-human"
          }`}
        >
          Field ceilings currently sum to {total} / 100
          {!onTarget && " — must equal exactly 100 to save."}
        </div>

        {error && (
          <p className="flex items-center gap-2 rounded-md border border-reject-edge bg-reject-dim px-3 py-2 text-sm text-text">
            <CircleAlert aria-hidden className="h-4 w-4 shrink-0 text-reject" strokeWidth={2.25} />
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 border-t border-border pt-5">
          <Button type="submit" variant="human" disabled={saving}>
            {saving ? "Saving…" : "Save as new version"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function PointMapEditor({
  title,
  points,
  onChange,
  onRemove,
  onAdd,
}: {
  title: string;
  points: Record<string, number>;
  onChange: (name: string, value: number) => void;
  onRemove: (name: string) => void;
  onAdd: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-text-dim">{title}</p>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1 text-xs text-machine hover:underline"
        >
          <Plus className="h-3 w-3" strokeWidth={2.5} />
          Add category
        </button>
      </div>
      <div className="mt-2 flex flex-col gap-1.5">
        {Object.entries(points).map(([name, value]) => (
          <div key={name} className="flex items-center gap-2">
            <span className="t-data w-40 truncate text-xs text-text-dim">{name}</span>
            <input
              type="number"
              value={value}
              onChange={(e) => onChange(name, Number(e.target.value))}
              className="input w-20"
            />
            <button
              type="button"
              onClick={() => onRemove(name)}
              className="text-text-faint hover:text-reject"
              aria-label={`Remove ${name}`}
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({
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
