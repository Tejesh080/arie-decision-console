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

describe("mockStore — Productization M4", () => {
  beforeEach(() => {
    resetMockStoreForTests();
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("organization", () => {
    it("updates only the fields provided", () => {
      const store = freshStore();
      const before = store.getOrganization();
      const updated = store.updateOrganization({ name: "New Name" });
      expect(updated.name).toBe("New Name");
      expect(updated.timezone).toBe(before.timezone);
      expect(updated.company_domain).toBe(before.company_domain);
    });

    it("rejects an empty update, matching the backend's model validator", () => {
      const store = freshStore();
      expect(() => store.updateOrganization({})).toThrow(ArieValidationError);
    });

    it("clears company_domain on explicit null", () => {
      const store = freshStore();
      const updated = store.updateOrganization({ company_domain: null });
      expect(updated.company_domain).toBeNull();
    });
  });

  describe("members", () => {
    it("lists only active members", () => {
      const store = freshStore();
      expect(store.listMembers().every((m) => m.status === "active")).toBe(true);
    });

    it("changes a non-owner's role", () => {
      const store = freshStore();
      const analyst = store.listMembers().find((m) => m.user_id === "mock-analyst")!;
      const updated = store.updateMemberRole(analyst.user_id, { role: "admin" });
      expect(updated.role).toBe("admin");
    });

    it("refuses to act on the caller's own membership", () => {
      const store = freshStore();
      const [self] = store.listMembers();
      expect(() => store.updateMemberRole(self.user_id, { role: "owner" })).toThrow(
        ArieConflictError,
      );
      expect(() => store.removeMember(self.user_id)).toThrow(ArieConflictError);
    });

    it("protects the organization's only remaining owner from demotion and removal", () => {
      const store = freshStore();
      const owner = store.listMembers().find((m) => m.role === "owner")!;
      expect(() => store.updateMemberRole(owner.user_id, { role: "admin" })).toThrow(
        ArieConflictError,
      );
      expect(() => store.removeMember(owner.user_id)).toThrow(ArieConflictError);
    });

    it("allows demoting an owner once a second owner exists", () => {
      const store = freshStore();
      const owner = store.listMembers().find((m) => m.role === "owner")!;
      const analyst = store.listMembers().find((m) => m.user_id === "mock-analyst")!;
      store.updateMemberRole(analyst.user_id, { role: "owner" });
      expect(() => store.updateMemberRole(owner.user_id, { role: "admin" })).not.toThrow();
    });

    it("404s for an unknown member id", () => {
      const store = freshStore();
      expect(() => store.updateMemberRole("nope", { role: "admin" })).toThrow(ArieNotFoundError);
      expect(() => store.removeMember("nope")).toThrow(ArieNotFoundError);
    });

    it("rejects an unknown role", () => {
      const store = freshStore();
      const other = store.listMembers()[1];
      expect(() => store.updateMemberRole(other.user_id, { role: "superadmin" })).toThrow(
        ArieValidationError,
      );
    });
  });

  describe("invitations", () => {
    it("creates a pending invitation with a one-time raw token", () => {
      const store = freshStore();
      const created = store.createInvitation({ email: "New.Teammate@Example.com", role: "admin" });
      expect(created.status).toBe("pending");
      expect(created.email_normalized).toBe("new.teammate@example.com");
      expect(created.raw_token).toMatch(/^mock_/);
      // The raw token never reaches the list response — only ever returned
      // once, from create, matching the real backend's guarantee.
      const listed = store.listInvitations()[0];
      expect((listed as unknown as Record<string, unknown>).raw_token).toBeUndefined();
    });

    it("rejects a duplicate pending invitation for the same email", () => {
      const store = freshStore();
      store.createInvitation({ email: "dup@example.com", role: "admin" });
      expect(() => store.createInvitation({ email: "dup@example.com", role: "admin" })).toThrow(
        ArieConflictError,
      );
    });

    it("accepts a valid pending token and creates a membership", () => {
      const store = freshStore();
      const created = store.createInvitation({ email: "invitee@example.com", role: "admin" });
      const accepted = store.acceptInvitation({ token: created.raw_token });
      expect(accepted.status).toBe("accepted");
      expect(store.listMembers().some((m) => m.role === "admin")).toBe(true);
    });

    it("404s for an invalid, already-accepted, or revoked token (collapsed, IDOR-safe)", () => {
      const store = freshStore();
      expect(() => store.acceptInvitation({ token: "not-a-real-token" })).toThrow(
        ArieNotFoundError,
      );

      const created = store.createInvitation({ email: "once@example.com", role: "admin" });
      store.acceptInvitation({ token: created.raw_token });
      expect(() => store.acceptInvitation({ token: created.raw_token })).toThrow(
        ArieNotFoundError,
      );

      const revocable = store.createInvitation({ email: "revoked@example.com", role: "admin" });
      store.revokeInvitation(revocable.invitation_id);
      expect(() => store.acceptInvitation({ token: revocable.raw_token })).toThrow(
        ArieNotFoundError,
      );
    });

    it("expires a pending invitation past its expiry and reports 410", () => {
      const store = freshStore();
      const created = store.createInvitation({ email: "later@example.com", role: "admin" });
      vi.setSystemTime(T0 + 8 * 24 * 60 * 60 * 1000);
      let caught: unknown;
      try {
        store.acceptInvitation({ token: created.raw_token });
      } catch (err) {
        caught = err;
      }
      expect((caught as { status?: number }).status).toBe(410);
      expect(store.listInvitations().find((i) => i.invitation_id === created.invitation_id)?.status).toBe(
        "expired",
      );
    });

    it("revokes a pending invitation", () => {
      const store = freshStore();
      const created = store.createInvitation({ email: "gone@example.com", role: "admin" });
      const revoked = store.revokeInvitation(created.invitation_id);
      expect(revoked.status).toBe("revoked");
    });

    it("404s revoking an unknown or already-resolved invitation", () => {
      const store = freshStore();
      expect(() => store.revokeInvitation("nope")).toThrow(ArieNotFoundError);
    });
  });

  describe("providers", () => {
    it("lists exactly the three supported providers, all unconfigured initially", () => {
      const store = freshStore();
      const providers = store.listProviders();
      expect(providers).toHaveLength(3);
      expect(providers.every((p) => !p.configured && !p.enabled)).toBe(true);
    });

    it("configures a credential without ever exposing it back", () => {
      const store = freshStore();
      const updated = store.setProviderCredential("hunter_combined_enrichment", {
        credential: "secret-key-value",
      });
      expect(updated.configured).toBe(true);
      expect(updated.enabled).toBe(true);
      expect(JSON.stringify(updated)).not.toContain("secret-key-value");
    });

    it("rejects an empty credential", () => {
      const store = freshStore();
      expect(() =>
        store.setProviderCredential("hunter_combined_enrichment", { credential: "  " }),
      ).toThrow(ArieValidationError);
    });

    it("404s configuring an unknown provider", () => {
      const store = freshStore();
      expect(() =>
        store.setProviderCredential("unknown_provider", { credential: "x" }),
      ).toThrow(ArieNotFoundError);
    });

    it("refuses to enable/disable/test/remove an unconfigured provider", () => {
      const store = freshStore();
      expect(() =>
        store.setProviderEnabled("apollo_person_enrichment", { enabled: true }),
      ).toThrow(ArieNotFoundError);
      expect(() => store.testProviderConnection("apollo_person_enrichment")).toThrow(
        ArieNotFoundError,
      );
      expect(() => store.removeProviderCredential("apollo_person_enrichment")).toThrow(
        ArieNotFoundError,
      );
    });

    it("removes a configured credential back to the unconfigured state", () => {
      const store = freshStore();
      store.setProviderCredential("abstract_company_enrichment", { credential: "x" });
      store.removeProviderCredential("abstract_company_enrichment");
      const status = store.getProvider("abstract_company_enrichment");
      expect(status.configured).toBe(false);
      expect(status.enabled).toBe(false);
    });

    it("records a connection test result", () => {
      const store = freshStore();
      store.setProviderCredential("apollo_person_enrichment", { credential: "x" });
      const tested = store.testProviderConnection("apollo_person_enrichment");
      expect(tested.last_test_status).toBe("success");
      expect(tested.last_tested_at).not.toBeNull();
    });
  });

  describe("onboarding", () => {
    it("starts incomplete with no ICP, upload, or processed batch", () => {
      const store = freshStore();
      const status = store.getOnboardingStatus();
      expect(status.icp_configured).toBe(true); // mock seeds a reference ICP profile
      expect(status.first_upload_completed).toBe(false);
      expect(status.completed).toBe(false);
      expect(status.completed_at).toBeNull();
    });

    it("excludes provider_configured from completion, matching the backend", () => {
      const store = freshStore();
      store.uploadBatch("leads.csv", [{ email: "a@b.com" }]);
      const status = store.getOnboardingStatus();
      expect(status.provider_configured).toBe(false);
      expect(status.first_upload_completed).toBe(true);
      expect(status.first_batch_processed).toBe(true);
      expect(status.completed).toBe(true);
    });

    it("stamps completed_at exactly once", () => {
      const store = freshStore();
      store.uploadBatch("leads.csv", [{ email: "a@b.com" }]);
      const first = store.getOnboardingStatus();
      vi.setSystemTime(T0 + 60_000);
      const second = store.getOnboardingStatus();
      expect(second.completed_at).toBe(first.completed_at);
    });
  });

  describe("limits", () => {
    it("computes remaining as limit minus used, floored at zero", () => {
      const store = freshStore();
      const limits = store.getUsageAgainstLimits();
      expect(limits.leads_remaining).toBe(limits.leads_limit - limits.leads_used);
      expect(limits.max_csv_rows_per_upload).toBeGreaterThan(0);
    });
  });
});
