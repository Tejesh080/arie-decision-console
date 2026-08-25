import { describe, expect, it } from "vitest";
import {
  decisionLabel,
  decisionPastTense,
  reviewActionLabel,
  reviewerNote,
  toneForStatus,
} from "./decision";
import type { LeadStatus } from "@/lib/api/types";

describe("decisionLabel", () => {
  it("maps known decision values to friendly labels", () => {
    expect(decisionLabel("auto_route")).toBe("Auto-route");
    expect(decisionLabel("reject")).toBe("Reject");
    expect(decisionLabel("escalate_human")).toBe("Escalate to human");
  });

  it("falls back to the raw value for anything unrecognized, never hides data", () => {
    expect(decisionLabel("some_future_decision")).toBe("some_future_decision");
  });
});

describe("decisionPastTense", () => {
  /**
   * Shadow mode renders "Would have {past tense}". This was originally
   * derived as `label.toLowerCase() + "d"`, which is correct for exactly one
   * of the three real decision values and produced "rejectd" and
   * "escalate to humand" for the other two.
   */
  it("gives real past tense for every decision the backend can emit", () => {
    expect(decisionPastTense("auto_route")).toBe("auto-routed");
    expect(decisionPastTense("reject")).toBe("rejected");
    expect(decisionPastTense("escalate_human")).toBe("escalated to a human");
  });

  it("never fabricates a suffix for an unrecognized value", () => {
    expect(decisionPastTense("some_future_decision")).toBe("some_future_decision");
  });
});

describe("reviewActionLabel", () => {
  it("maps known review actions", () => {
    expect(reviewActionLabel("approve")).toBe("Approved");
    expect(reviewActionLabel("reject")).toBe("Rejected");
    expect(reviewActionLabel("edit")).toBe("Edited (manual review)");
  });

  it("renders a dash for a pending (null) action", () => {
    expect(reviewActionLabel(null)).toBe("—");
  });
});

describe("reviewerNote", () => {
  it.each([null, undefined, "", "   ", "NA", "N/A", "n/a", " na "])(
    "treats %j as an absent note",
    (input) => {
      expect(reviewerNote(input)).toBeNull();
    },
  );

  it("trims and returns a real note", () => {
    expect(reviewerNote("  Title was misread  ")).toBe("Title was misread");
  });
});

describe("toneForStatus", () => {
  const cases: [LeadStatus, string][] = [
    ["AUTO_ROUTED", "qualify"],
    ["ROUTED", "qualify"],
    ["MANUAL_REVIEW", "qualify"],
    ["SYNCED", "reject"],
    ["AWAITING_HUMAN", "human"],
    ["FAILED", "reject"],
    ["DEAD_LETTER", "reject"],
    ["NEW", "pending"],
    ["SCORING", "pending"],
  ];

  it.each(cases)("maps %s to tone %s, mirroring backend status groups", (status, tone) => {
    expect(toneForStatus(status)).toBe(tone);
  });
});
