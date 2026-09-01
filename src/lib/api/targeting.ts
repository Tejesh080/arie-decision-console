import { apiClient } from "./client";
import { getDataMode } from "./mode";
import { mockStore } from "./mock/store";
import type {
  ICPProfile,
  TargetingConfirmRequest,
  TargetingDraftRequest,
  TargetingDraftResponse,
  TargetingVocabularies,
} from "./types";

/**
 * Generating a draft changes nothing on the server — it is a POST because it
 * spends the organization's AI budget and its input is two paragraphs of free
 * text, not because it writes.
 *
 * The timeout is well above the transport default: a model call plus one
 * bounded repair retry is genuinely slow, and the alternative to waiting is a
 * client-side abort that leaves the customer thinking it failed while the
 * backend has already been billed for the call.
 */
export async function draftTargetingProfile(
  input: TargetingDraftRequest,
): Promise<TargetingDraftResponse> {
  if (getDataMode() === "mock") return mockDraft(input);
  return apiClient.post<TargetingDraftResponse>("/intelligence/targeting/draft", input, {
    timeoutMs: 60_000,
  });
}

/** Confirming makes no model call, so this needs no extended timeout. */
export async function confirmTargetingProfile(input: TargetingConfirmRequest): Promise<ICPProfile> {
  if (getDataMode() === "mock") {
    // The real backend recomputes the scoring configuration from the reviewed
    // profile. Mock mode has no normaliser, so it stores the config the mock
    // store already holds — enough to exercise "a new active version
    // appeared", which is the only thing a demo can honestly show here.
    return mockStore.createICPProfile({
      name: input.name,
      config: mockStore.getActiveICPProfile().config,
    });
  }
  return apiClient.post<ICPProfile>("/intelligence/targeting/confirm", input);
}

export async function getTargetingVocabularies(): Promise<TargetingVocabularies> {
  if (getDataMode() === "mock") {
    return {
      industries: ["retail", "ecommerce", "hospitality", "software", "other"],
      seniorities: ["c_level", "vp", "director", "manager", "ic"],
      functions: ["operations", "sales", "marketing", "finance", "other"],
      objectives: [
        "best_prospects",
        "maximize_buy_likelihood",
        "high_value",
        "minimize_wasted_outreach",
        "custom",
      ],
      preference_levels: ["none", "low", "medium", "high", "critical"],
      scoring_dimensions: [
        "employee_count",
        "industry",
        "title_seniority",
        "title_function",
        "buying_intent",
        "recent_trigger_event",
      ],
    };
  }
  return apiClient.get<TargetingVocabularies>("/intelligence/targeting/vocabularies");
}

/**
 * A fixed, obviously-synthetic interpretation for demo mode.
 *
 * Mock mode has no model and no normaliser, so this is a canned answer rather
 * than a simulation of one — the supplement-wholesaler scenario the product is
 * designed around. It ignores what was typed, and its summary says so, because
 * a demo that produced a plausible-looking reading of text nobody interpreted
 * would be exactly the kind of fabricated result this project does not ship.
 */
function mockDraft(input: TargetingDraftRequest): TargetingDraftResponse {
  return {
    objective: input.objective,
    profile: {
      offering_summary: "Wholesale sports supplements to gyms and retailers.",
      plain_english_summary:
        "This is a fixed demo interpretation, not a reading of what you typed — demo mode has " +
        "no model behind it. It shows the supplement-wholesaler example: gyms, supplement " +
        "retailers and distributors, reaching owners and purchasing managers.",
      ideal_company_types: ["multi-location gym", "supplement retailer", "distributor"],
      preferred_industries: ["retail", "ecommerce"],
      acceptable_industries: ["hospitality"],
      employee_band_preferences: {
        employees_1_10: "avoid",
        employees_11_50: "preferred",
        employees_51_200: "preferred",
        employees_201_1000: "acceptable",
        employees_1001_plus: "acceptable",
      },
      preferred_seniorities: ["c_level"],
      acceptable_seniorities: ["director", "manager"],
      preferred_functions: ["operations"],
      acceptable_functions: ["sales"],
      preferred_titles: ["Owner", "Founder", "Purchasing Manager"],
      preferred_geographies: ["Australia"],
      preferred_company_characteristics: ["operates more than one location"],
      positive_indicators: ["multiple locations", "established retail operation"],
      negative_indicators: ["solo personal trainer", "single-person business"],
      hard_disqualifiers: ["individual personal trainers with no premises"],
      research_worthy_unknowns: ["how many locations the business operates"],
      relative_preferences: {
        employee_count: "high",
        industry: "high",
        title_seniority: "critical",
        title_function: "high",
        buying_intent: "medium",
        recent_trigger_event: "low",
      },
    },
    scoring_config: mockStore.getActiveICPProfile().config,
    // What the real normaliser produces for the preferences above: weights
    // 4/4/7/4/2/1 spread over 100 points by largest remainder.
    allocation: [
      { dimension: "title_seniority", label: "Contact seniority", points: 32, rank: 1 },
      { dimension: "employee_count", label: "Company size", points: 18, rank: 2 },
      { dimension: "industry", label: "Industry", points: 18, rank: 3 },
      { dimension: "title_function", label: "Contact's role", points: 18, rank: 4 },
      { dimension: "buying_intent", label: "Signs of buying intent", points: 9, rank: 5 },
      { dimension: "recent_trigger_event", label: "Recent trigger event", points: 5, rank: 6 },
    ],
    llm_provider: "demo",
    llm_model: "none (demo mode)",
    llm_cost_usd: "0.0000",
  };
}
