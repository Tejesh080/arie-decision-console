import { apiClient } from "./client";
import { getDataMode } from "./mode";
import { mockStore } from "./mock/store";
import type { ReviewDecisionRequest, ReviewDecisionResponse, ReviewResponse } from "./types";

export async function getReview(reviewId: string): Promise<ReviewResponse> {
  if (getDataMode() === "mock") return mockStore.getReview(reviewId);
  return apiClient.get<ReviewResponse>(`/reviews/${encodeURIComponent(reviewId)}`);
}

export async function submitReviewDecision(
  reviewId: string,
  request: ReviewDecisionRequest,
): Promise<ReviewDecisionResponse> {
  if (getDataMode() === "mock") return mockStore.submitReviewDecision(reviewId, request);
  return apiClient.post<ReviewDecisionResponse>(
    `/reviews/${encodeURIComponent(reviewId)}/decision`,
    request,
  );
}
