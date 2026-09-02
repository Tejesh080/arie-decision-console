import { apiClient } from "./client";
import { getDataMode } from "./mode";
import { mockStore } from "./mock/store";
import type { FeedbackInsights } from "./types";

/** M7 Slice 7, Parts A-C. Read-only, safe on every load — never creates a
 * proposal. See `getFeedbackAnalysis` for the one action that can. */
export async function getFeedbackInsights(): Promise<FeedbackInsights> {
  if (getDataMode() === "mock") return mockStore.getFeedbackInsights();
  return apiClient.get<FeedbackInsights>("/intelligence/feedback-insights");
}

/** The explicit "Analyze feedback" action — may create or reuse a
 * `USER_FEEDBACK` targeting proposal. Never triggered automatically by a
 * single feedback submission (Part B2). */
export async function analyzeFeedback(): Promise<FeedbackInsights> {
  if (getDataMode() === "mock") return mockStore.getFeedbackInsights();
  return apiClient.post<FeedbackInsights>(
    "/intelligence/feedback/analyze",
    {},
    { timeoutMs: 20_000 },
  );
}
