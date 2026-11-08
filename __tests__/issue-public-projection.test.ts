import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PUBLIC_ISSUE_DETAIL_FIELDS, PUBLIC_ISSUE_FIELDS } from "@/lib/services/issues";

/**
 * Reply-state fields drive the staff queue ordering and are staff-workload data.
 * They must never ride along on a published/student projection, which uses this
 * allowlist instead of the whole document.
 */
describe("public issue projection", () => {
  it("does not expose reply-state fields", () => {
    const fields = PUBLIC_ISSUE_FIELDS.split(/\s+/);

    expect(fields).not.toContain("awaitingStaff");
    expect(fields).not.toContain("lastStaffReplyAt");
    expect(fields).not.toContain("lastStudentReplyAt");
    expect(fields).not.toContain("studentEmailEncrypted");
    expect(fields).not.toContain("studentEmailLookup");
  });

  it("still carries the fields a student-facing card needs", () => {
    const fields = PUBLIC_ISSUE_FIELDS.split(/\s+/);

    expect(fields).toEqual(
      expect.arrayContaining(["title", "question", "status", "tags"]),
    );
  });

  it("keeps uploads off the list projection but on the published detail", () => {
    expect(PUBLIC_ISSUE_FIELDS.split(/\s+/)).not.toContain("uploads");
    expect(PUBLIC_ISSUE_DETAIL_FIELDS.split(/\s+/)).toContain("uploads");
  });
});
