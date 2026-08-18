import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArieConflictError, ArieNotFoundError, ArieValidationError } from "../errors";
import { mockStore as store, resetMockStoreForTests } from "./store";

// A single static import (not `vi.resetModules()` + dynamic re-import)
// keeps this file's `ArieConflictError`/etc. the *same* class objects the
// store throws, so `instanceof`/`toThrow(SomeClass)` checks work.
// `resetMockStoreForTests()` clears both localStorage and the singleton's
// in-memory cache between cases instead.
function freshStore() {
  return store;
}

const T0 = 1_700_000_000_000;

describe("mockStore", () => {
  beforeEach(() => {
    resetMockStoreForTests();
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a lead with status NEW and a fresh lead_id", () => {
    const store = freshStore();
    const result = store.createLead({ source: "test", email: "a@b.com" });
    expect(result.created).toBe(true);
    expect(result.status).toBe("NEW");
    expect(result.lead_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("is idempotent on (source, external_ref), matching the backend's own key", () => {
    const store = freshStore();
    const first = store.createLead({ source: "test", email: "a@b.com", external_ref: "r1" });
    const second = store.createLead({
      source: "test",
      email: "different@b.com",
      external_ref: "r1",
    });
    expect(second.created).toBe(false);
    expect(second.lead_id).toBe(first.lead_id);
  });

  it("treats the same external_ref under a different source as a distinct lead", () => {
    const store = freshStore();
    const first = store.createLead({ source: "a", email: "a@b.com", external_ref: "r1" });
    const second = store.createLead({ source: "b", email: "a@b.com", external_ref: "r1" });
    expect(second.created).toBe(true);
    expect(second.lead_id).not.toBe(first.lead_id);
  });

  it("rejects a lead with no email", () => {
    const store = freshStore();
    expect(() => store.createLead({ source: "test", email: "" })).toThrow(ArieValidationError);
  });

  it("progresses status purely as a function of elapsed time (refresh-safe)", () => {
    const store = freshStore();
    const { lead_id } = store.createLead({ source: "test", email: "a@b.com" });

    expect(store.getLead(lead_id).status).toBe("NEW");
    vi.setSystemTime(T0 + 500);
    expect(store.getLead(lead_id).status).toBe("SCORING");
    vi.setSystemTime(T0 + 1000);
    expect(store.getLead(lead_id).status).toBe("FETCHING_EVIDENCE");
    vi.setSystemTime(T0 + 1600);
    expect(store.getLead(lead_id).status).toBe("INTEGRATING");
    vi.setSystemTime(T0 + 1900);
    expect(store.getLead(lead_id).status).toBe("DECISION");
  });

  it("settles the autonomous demo identity to AUTO_ROUTED with no human review", () => {
    const store = freshStore();
    const { lead_id } = store.createLead({
      source: "test",
      email: "nadia.delacroix@lumen500.com",
    });
    vi.setSystemTime(T0 + 3000);

    const lead = store.getLead(lead_id);
    expect(lead.status).toBe("AUTO_ROUTED");

    const receipt = store.getReceipt(lead_id);
    expect(receipt.status).toBe("decided");
    expect(receipt.decision?.autonomous).toBe(true);
    expect(receipt.decision?.recommended_action).toBe("auto_route");
    expect(receipt.human_review).toBeNull();
  });

  it("splits fresh calls from cache reuse and never conflates them", () => {
    const store = freshStore();
    const { lead_id } = store.createLead({
      source: "test",
      email: "nadia.delacroix@lumen500.com",
    });
    vi.setSystemTime(T0 + 3000);

    const receipt = store.getReceipt(lead_id);
    const fresh = receipt.providers.called.filter((c) => !c.cache_hit);
    const cached = receipt.providers.called.filter((c) => c.cache_hit);
    expect(fresh.length).toBeGreaterThan(0);
    expect(fresh.length + cached.length).toBe(receipt.providers.called.length);
    // not_called must be a genuine set difference against the catalogue --
    // never overlapping with what was actually called.
    const calledNames = new Set(receipt.providers.called.map((c) => c.provider));
    for (const name of receipt.providers.not_called) {
      expect(calledNames.has(name)).toBe(false);
    }
  });

  it("settles the escalation demo identity to AWAITING_HUMAN with a pending review", () => {
    const store = freshStore();
    const { lead_id } = store.createLead({
      source: "test",
      email: "nadia.haddad@cobalt500.com",
    });
    vi.setSystemTime(T0 + 3000);

    const receipt = store.getReceipt(lead_id);
    expect(receipt.lead_status).toBe("AWAITING_HUMAN");
    expect(receipt.decision?.autonomous).toBe(false);
    expect(receipt.decision?.recommended_action).toBe("reject");
    expect(receipt.human_review).not.toBeNull();
    expect(receipt.human_review?.required).toBe(true);

    const review = store.getReview(receipt.human_review!.review_id);
    expect(review.is_pending).toBe(true);
    expect(review.original_decision).toBe("reject");
  });

  it("approving a pending review flips the lead to AUTO_ROUTED and marks a human override", () => {
    const store = freshStore();
    const { lead_id } = store.createLead({ source: "test", email: "nadia.haddad@cobalt500.com" });
    vi.setSystemTime(T0 + 3000);

    const before = store.getReceipt(lead_id);
    const reviewId = before.human_review!.review_id;
    const review = store.getReview(reviewId);

    const result = store.submitReviewDecision(reviewId, {
      action: "approve",
      reviewer: "test-reviewer",
      expected_lead_version: review.lead_version,
    });

    expect(result.already_applied).toBe(false);
    expect(result.lead_status).toBe("AUTO_ROUTED");
    expect(result.lead_version).toBe(review.lead_version + 1);

    const after = store.getReceipt(lead_id);
    expect(after.lead_status).toBe("AUTO_ROUTED");
    expect(after.decision?.human_override).toBe(true);
    expect(after.decision?.recommended_action).toBe("reject"); // frozen, never rewritten
  });

  it("an identical retry of the same decision is idempotent, not an error", () => {
    const store = freshStore();
    const { lead_id } = store.createLead({ source: "test", email: "nadia.haddad@cobalt500.com" });
    vi.setSystemTime(T0 + 3000);
    const reviewId = store.getReceipt(lead_id).human_review!.review_id;
    const review = store.getReview(reviewId);

    const first = store.submitReviewDecision(reviewId, {
      action: "approve",
      reviewer: "same-reviewer",
      notes: null,
      expected_lead_version: review.lead_version,
    });
    expect(first.already_applied).toBe(false);

    const second = store.submitReviewDecision(reviewId, {
      action: "approve",
      reviewer: "same-reviewer",
      notes: null,
      expected_lead_version: review.lead_version,
    });
    expect(second.already_applied).toBe(true);
    expect(second.lead_version).toBe(first.lead_version);
  });

  it("a genuinely conflicting resubmission is rejected, not silently overwritten", () => {
    const store = freshStore();
    const { lead_id } = store.createLead({ source: "test", email: "nadia.haddad@cobalt500.com" });
    vi.setSystemTime(T0 + 3000);
    const reviewId = store.getReceipt(lead_id).human_review!.review_id;
    const review = store.getReview(reviewId);

    store.submitReviewDecision(reviewId, {
      action: "approve",
      reviewer: "reviewer-a",
      expected_lead_version: review.lead_version,
    });

    expect(() =>
      store.submitReviewDecision(reviewId, {
        action: "reject",
        reviewer: "reviewer-b",
        expected_lead_version: review.lead_version,
      }),
    ).toThrow(ArieConflictError);
  });

  it("rejects a stale expected_lead_version with a conflict, matching optimistic concurrency", () => {
    const store = freshStore();
    const { lead_id } = store.createLead({ source: "test", email: "nadia.haddad@cobalt500.com" });
    vi.setSystemTime(T0 + 3000);
    const reviewId = store.getReceipt(lead_id).human_review!.review_id;

    expect(() =>
      store.submitReviewDecision(reviewId, {
        action: "approve",
        reviewer: "someone",
        expected_lead_version: 999,
      }),
    ).toThrow(ArieConflictError);
  });

  it("requires non-empty notes for an edit action, matching the backend's validator", () => {
    const store = freshStore();
    const { lead_id } = store.createLead({ source: "test", email: "nadia.haddad@cobalt500.com" });
    vi.setSystemTime(T0 + 3000);
    const reviewId = store.getReceipt(lead_id).human_review!.review_id;
    const review = store.getReview(reviewId);

    expect(() =>
      store.submitReviewDecision(reviewId, {
        action: "edit",
        reviewer: "someone",
        notes: "   ",
        expected_lead_version: review.lead_version,
      }),
    ).toThrow(ArieValidationError);
  });

  it("throws ArieNotFoundError for an unknown lead or review id", () => {
    const store = freshStore();
    expect(() => store.getLead("00000000-0000-0000-0000-000000000000")).toThrow(ArieNotFoundError);
    expect(() => store.getReview("00000000-0000-0000-0000-000000000000")).toThrow(
      ArieNotFoundError,
    );
  });

  it("reports a healthy mock backend", () => {
    const store = freshStore();
    expect(store.getHealth()).toEqual({ status: "ok", database: true, schema_ready: true });
  });
});
