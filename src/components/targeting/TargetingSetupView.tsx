"use client";

import { useCallback, useState } from "react";
import { CircleAlert, Sparkles } from "lucide-react";
import { confirmTargetingProfile, draftTargetingProfile } from "@/lib/api/targeting";
import { ArieApiError } from "@/lib/api/errors";
import type {
  BandPreference,
  BusinessProfileDraft,
  ICPProfile,
  PreferenceLevel,
  ScoringDimensionKey,
  TargetingDraftResponse,
  TargetingObjective,
} from "@/lib/api/types";
import { Panel, Eyebrow, PanelHeader } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { HistoricalOutcomes } from "./HistoricalOutcomes";
import { FeedbackInsightsPanel } from "./FeedbackInsightsPanel";

/**
 * The primary way a customer configures targeting: two questions in their own
 * words, then a review of what ARIE understood.
 *
 * `ICPConfigView` still exists and still works — an admin who wants to set six
 * point weights by hand can. This is the path that does not require them to.
 *
 * What this component deliberately does not do: compute anything. The point
 * allocation, the thresholds and the whole scoring configuration come from the
 * backend, and confirming sends back the *reviewed profile*, never a
 * configuration — the server recomputes it. A bug here can therefore make the
 * preview wrong, but it cannot make the profile a customer confirms wrong.
 */

const OBJECTIVES: { value: TargetingObjective; label: string; hint: string }[] = [
  {
    value: "best_prospects",
    label: "Best overall prospects",
    hint: "A balanced read of who fits you best.",
  },
  {
    value: "maximize_buy_likelihood",
    label: "Highest likelihood to buy",
    hint: "Weights signs of active buying intent more heavily.",
  },
  {
    value: "high_value",
    label: "Highest-value opportunities",
    hint: "Leans towards larger, more established businesses.",
  },
  {
    value: "minimize_wasted_outreach",
    label: "Minimise wasted outreach",
    hint: "Sets a higher bar, so fewer leads are marked worth contacting.",
  },
  { value: "custom", label: "Something else", hint: "Uses the balanced default." },
];

const LEVEL_LABELS: Record<PreferenceLevel, string> = {
  none: "Not considered",
  low: "Minor",
  medium: "Moderate",
  high: "Important",
  critical: "Decisive",
};

const BAND_LABELS: Record<string, string> = {
  employees_1_10: "1–10 people",
  employees_11_50: "11–50 people",
  employees_51_200: "51–200 people",
  employees_201_1000: "201–1,000 people",
  employees_1001_plus: "1,000+ people",
};

const BAND_PREFERENCE_LABELS: Record<BandPreference, string> = {
  preferred: "Ideal",
  acceptable: "Worth contacting",
  avoid: "Avoid",
};

/** `retail` -> `Retail`, `financial_services` -> `Financial services`. The
 * backend's canonical values are machine identifiers; nobody should be shown
 * one. */
function humanize(value: string): string {
  const spaced = value.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function List({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-text-faint">Nothing specific.</p>;
  }
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li key={item}>
          <Badge>{humanize(item)}</Badge>
        </li>
      ))}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="mb-2 text-[0.8125rem] font-medium uppercase tracking-wide text-text-dim">
        {title}
      </h3>
      {children}
    </div>
  );
}

export function TargetingSetupView({ canEdit }: { canEdit: boolean }) {
  const [whatYouSell, setWhatYouSell] = useState("");
  const [whoYouWant, setWhoYouWant] = useState("");
  const [objective, setObjective] = useState<TargetingObjective>("best_prospects");

  const [draft, setDraft] = useState<TargetingDraftResponse | null>(null);
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<ICPProfile | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [edited, setEdited] = useState(false);
  const [name, setName] = useState("");

  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    setConfirmed(null);
    try {
      const response = await draftTargetingProfile({
        what_you_sell: whatYouSell,
        who_you_want: whoYouWant,
        objective,
      });
      setDraft(response);
      setEdited(false);
      setName((current) => current || "AI-generated targeting");
    } catch (err) {
      // ArieApiError already carries the backend's own customer-safe detail —
      // the budget message with the organization's real figures in it, or the
      // "not configured"/"temporarily unavailable" text. Re-wording it here
      // would replace something specific with something vague.
      setError(err instanceof ArieApiError ? err.message : String(err));
      setDraft(null);
    } finally {
      setGenerating(false);
    }
  }, [whatYouSell, whoYouWant, objective]);

  const confirm = useCallback(async () => {
    if (!draft) return;
    setConfirming(true);
    setError(null);
    try {
      const profile = await confirmTargetingProfile({
        name: name.trim() || "AI-generated targeting",
        objective: draft.objective,
        // The reviewed profile, and nothing derived from it. The server
        // recomputes every number.
        profile: draft.profile,
        llm_provider: draft.llm_provider,
        llm_model: draft.llm_model,
      });
      setConfirmed(profile);
      setDraft(null);
    } catch (err) {
      setError(err instanceof ArieApiError ? err.message : String(err));
    } finally {
      setConfirming(false);
    }
  }, [draft, name]);

  /** Edit the reviewed profile in place.
   *
   * Editing makes the point allocation shown below stale, and this component
   * deliberately does not recompute it: the allocator lives on the server and
   * duplicating it here would create a second implementation that could
   * disagree with the one that actually runs. So the preview is marked stale
   * instead, and the real numbers arrive with the confirmed profile. */
  const editProfile = useCallback((update: Partial<BusinessProfileDraft>) => {
    setEdited(true);
    setDraft((current) =>
      current ? { ...current, profile: { ...current.profile, ...update } } : current,
    );
  }, []);

  const canGenerate =
    canEdit && !generating && whatYouSell.trim().length > 0 && whoYouWant.trim().length > 0;

  return (
    <div className="mx-auto max-w-[900px] px-5 py-10 sm:px-8">
      <header className="mb-8">
        <Eyebrow>Targeting</Eyebrow>
        <h1 className="t-h1 mt-2 text-text">Tell ARIE who you are trying to reach</h1>
        <p className="mt-3 max-w-2xl text-[0.9375rem] leading-relaxed text-text-dim">
          Describe your business in your own words. ARIE turns that into the targeting profile it
          scores every new lead against — and shows you exactly what it understood before anything
          changes.
        </p>
      </header>

      {!canEdit && (
        <Panel className="mb-6">
          <p className="text-sm text-text-dim">
            Only an owner or admin can change targeting for this organization.
          </p>
        </Panel>
      )}

      {error && (
        <Panel className="mb-6 border-reject-edge" accent="reject">
          <p className="flex items-start gap-2 text-sm text-text">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </p>
        </Panel>
      )}

      {confirmed && (
        <Panel className="mb-6 border-qualify-edge" accent="qualify">
          <PanelHeader title={`Version ${confirmed.version} is now active`} />
          <p className="mt-2 text-sm text-text-dim">
            Every new lead is scored against this profile from now on. Leads already decided keep
            the version that produced them — nothing is rewritten.
          </p>
        </Panel>
      )}

      {!draft && (
        <Panel>
          <form
            className="flex flex-col gap-6"
            onSubmit={(event) => {
              event.preventDefault();
              void generate();
            }}
          >
            <div>
              <label htmlFor="what-you-sell" className="mb-2 block text-sm font-medium text-text">
                What do you sell?
              </label>
              <textarea
                id="what-you-sell"
                value={whatYouSell}
                onChange={(event) => setWhatYouSell(event.target.value)}
                disabled={!canEdit}
                rows={3}
                maxLength={4000}
                placeholder="We wholesale sports supplements to gyms and retailers."
                className="w-full rounded-md border border-edge bg-surface px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-accent focus:outline-none disabled:opacity-50"
              />
            </div>

            <div>
              <label htmlFor="who-you-want" className="mb-2 block text-sm font-medium text-text">
                Who are you trying to reach?
              </label>
              <textarea
                id="who-you-want"
                value={whoYouWant}
                onChange={(event) => setWhoYouWant(event.target.value)}
                disabled={!canEdit}
                rows={5}
                maxLength={4000}
                placeholder={
                  "Multi-location gyms, supplement stores and distributors. Owners, founders and " +
                  "purchasing managers are best. Solo personal trainers are usually too small."
                }
                className="w-full rounded-md border border-edge bg-surface px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-accent focus:outline-none disabled:opacity-50"
              />
              <p className="mt-2 text-xs text-text-faint">
                Mention what you want and what you do not. Anything you rule out is kept as a rule,
                not a preference.
              </p>
            </div>

            <div>
              <label htmlFor="objective" className="mb-2 block text-sm font-medium text-text">
                What are you optimising for?
              </label>
              <select
                id="objective"
                value={objective}
                onChange={(event) => setObjective(event.target.value as TargetingObjective)}
                disabled={!canEdit}
                className="w-full rounded-md border border-edge bg-surface px-3 py-2 text-sm text-text focus:border-accent focus:outline-none disabled:opacity-50"
              >
                {OBJECTIVES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-text-faint">
                {OBJECTIVES.find((option) => option.value === objective)?.hint}
              </p>
            </div>

            <div>
              <Button type="submit" disabled={!canGenerate}>
                <Sparkles className="size-4" aria-hidden />
                {generating ? "Reading your description…" : "Generate targeting profile"}
              </Button>
              <p className="mt-2 text-xs text-text-faint">
                Nothing changes until you review and confirm.
              </p>
            </div>
          </form>
        </Panel>
      )}

      {draft && (
        <>
          <Panel className="mb-6">
            <PanelHeader title="ARIE understood" />
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-text">
              {draft.profile.plain_english_summary}
            </p>

            <div className="mt-6 border-t border-edge pt-5">
              <Section title="What you sell">
                <p className="text-sm text-text-dim">{draft.profile.offering_summary}</p>
              </Section>

              <Section title="Best companies">
                <List
                  items={[
                    ...draft.profile.ideal_company_types,
                    ...draft.profile.preferred_industries,
                  ]}
                />
              </Section>

              <Section title="Best contacts">
                <List
                  items={[
                    ...draft.profile.preferred_titles,
                    ...draft.profile.preferred_seniorities,
                    ...draft.profile.preferred_functions,
                  ]}
                />
              </Section>

              <Section title="Company size">
                <ul className="flex flex-wrap gap-1.5">
                  {Object.entries(draft.profile.employee_band_preferences).map(
                    ([band, preference]) => (
                      <li key={band}>
                        <Badge>
                          {BAND_LABELS[band] ?? band} — {BAND_PREFERENCE_LABELS[preference]}
                        </Badge>
                      </li>
                    ),
                  )}
                </ul>
              </Section>

              <Section title="Positive signals">
                <List
                  items={[
                    ...draft.profile.positive_indicators,
                    ...draft.profile.preferred_company_characteristics,
                  ]}
                />
              </Section>

              <Section title="Lower priority or avoid">
                <List
                  items={[
                    ...draft.profile.negative_indicators,
                    ...draft.profile.hard_disqualifiers,
                  ]}
                />
              </Section>

              {draft.profile.preferred_geographies.length > 0 && (
                <Section title="Where you sell">
                  <List items={draft.profile.preferred_geographies} />
                  <p className="mt-2 text-xs text-text-faint">
                    Recorded for context. ARIE does not score geography today.
                  </p>
                </Section>
              )}
            </div>
          </Panel>

          <Panel className="mb-6">
            <PanelHeader title="How ARIE will weigh a lead" />
            <p className="mt-2 text-sm text-text-dim">
              Out of 100 points for every lead. ARIE worked these out from your description — you
              never have to set them yourself, but you can change how much each one matters.
            </p>
            {edited && (
              <p className="mt-3 text-xs text-text-faint">
                You have changed how much something matters, so these point totals are out of date.
                ARIE recalculates them when you confirm.
              </p>
            )}
            <ul className="mt-4 flex flex-col gap-2.5">
              {draft.allocation.map((row) => {
                const key = row.dimension as ScoringDimensionKey;
                const level = draft.profile.relative_preferences[key] ?? "medium";
                return (
                  <li key={row.dimension} className="flex flex-wrap items-center gap-3">
                    <span className="w-44 shrink-0 text-sm text-text">{row.label}</span>
                    <span
                      className={`h-2 rounded-full ${edited ? "bg-edge" : "bg-accent"}`}
                      style={{ width: `${row.points * 4}px` }}
                      aria-hidden
                    />
                    <span
                      className={`text-sm tabular-nums ${edited ? "text-text-faint line-through" : "text-text-dim"}`}
                    >
                      {row.points} pts
                    </span>
                    <label className="sr-only" htmlFor={`level-${key}`}>
                      How much {row.label} matters
                    </label>
                    <select
                      id={`level-${key}`}
                      value={level}
                      disabled={!canEdit}
                      onChange={(event) =>
                        editProfile({
                          relative_preferences: {
                            ...draft.profile.relative_preferences,
                            [key]: event.target.value as PreferenceLevel,
                          },
                        })
                      }
                      className="rounded-md border border-edge bg-surface px-2 py-1 text-xs text-text-dim focus:border-accent focus:outline-none disabled:opacity-50"
                    >
                      {(Object.keys(LEVEL_LABELS) as PreferenceLevel[]).map((option) => (
                        <option key={option} value={option}>
                          {LEVEL_LABELS[option]}
                        </option>
                      ))}
                    </select>
                  </li>
                );
              })}
            </ul>

            <div className="mt-5 border-t border-edge pt-4">
              <button
                type="button"
                onClick={() => setShowAdvanced((current) => !current)}
                className="text-sm text-text-dim underline underline-offset-4 hover:text-text"
              >
                {showAdvanced ? "Hide advanced details" : "Advanced details"}
              </button>
              {showAdvanced && (
                <div className="mt-4">
                  <p className="mb-2 text-xs text-text-faint">
                    {edited
                      ? "The configuration ARIE generated before your edits. Confirming recalculates it from the profile above."
                      : "The exact scoring configuration confirming would create."}{" "}
                    Generated by {draft.llm_model ?? "the configured model"}; modelled AI cost{" "}
                    {draft.llm_cost_usd} USD (an estimate from token counts, not a billed figure).
                  </p>
                  <pre className="max-h-96 overflow-auto rounded-md border border-edge bg-surface p-3 text-xs text-text-dim">
                    {JSON.stringify(draft.scoring_config, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Confirm this profile" />
            <p className="mt-2 text-sm text-text-dim">
              Confirming creates a new immutable version and makes it active. Leads already decided
              keep the version that produced them.
            </p>
            <div className="mt-4 flex flex-col gap-4">
              <div>
                <label htmlFor="profile-name" className="mb-2 block text-sm font-medium text-text">
                  Name this profile
                </label>
                <input
                  id="profile-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={200}
                  className="w-full rounded-md border border-edge bg-surface px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => void confirm()} disabled={confirming || !canEdit}>
                  {confirming ? "Confirming…" : "Confirm profile"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDraft(null);
                    setEdited(false);
                    setError(null);
                  }}
                  disabled={confirming}
                >
                  Start over
                </Button>
              </div>
              <p className="text-xs text-text-faint">
                Not quite right? Reword your description and generate again — nothing is saved until
                you confirm.
              </p>
            </div>
          </Panel>
        </>
      )}

      {/* Optional, and last: a customer with no past results should never feel
          they are missing a step. It sits outside the draft flow because it
          proposes changes to whatever profile is already active, not to the
          draft being reviewed above. */}
      {!draft && (
        <>
          <FeedbackInsightsPanel canEdit={canEdit} onProfileUpdated={setConfirmed} />
          <HistoricalOutcomes canEdit={canEdit} onProfileUpdated={setConfirmed} />
        </>
      )}
    </div>
  );
}
