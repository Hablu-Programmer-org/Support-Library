import { describe, expect, it } from "vitest";

import { buildSearchFieldUpdate } from "@/lib/search-index-build";

const issue = {
  title: "React image not rendering",
  question: "Image not displaying after upload",
  studentName: "Rahim Uddin",
  batchNo: 12,
  courseSlug: "react-beginner",
  moduleSlug: "assets",
  contentSlug: "images-lecture",
  tags: ["react", "image"],
  videoLinks: [{ title: "Lecture walkthrough", summary: "Uploads in detail" }],
  uploads: [{ originalName: "rahim-passport.png" }],
};

describe("buildSearchFieldUpdate", () => {
  it("builds both scopes from the same thread", () => {
    const now = new Date("2026-11-07T10:00:00.000Z");
    const update = buildSearchFieldUpdate(
      issue,
      [
        { body: "Move the file into the public folder", isStaffReply: true },
        { body: "I moved it but it still fails", isStaffReply: false },
      ],
      new Map(),
      now,
    );

    expect(update.searchUpdatedAt).toBe(now);
    expect(update.searchText).toContain("rahim uddin");
    expect(update.searchText).toContain("batch 12");
    expect(update.searchText).toContain("rahim-passport.png");
    expect(update.searchText).toContain("i moved it but it still fails");

    expect(update.publicSearchText).toContain("move the file into the public folder");
    expect(update.publicSearchText).toContain("batch 12");
    expect(update.publicSearchText).not.toContain("rahim");
    expect(update.publicSearchText).not.toContain("passport");
  });

  it("uses the author role when isStaffReply is missing on a legacy reply", () => {
    const update = buildSearchFieldUpdate(
      issue,
      [
        { body: "legacy staff answer", authorId: "staff-1" },
        { body: "legacy student words", authorId: "student-1" },
      ],
      new Map([
        ["staff-1", "ADMIN"],
        ["student-1", "STUDENT"],
      ]),
    );

    expect(update.publicSearchText).toContain("legacy staff answer");
    expect(update.publicSearchText).not.toContain("legacy student words");
    expect(update.searchText).toContain("legacy student words");
  });

  it("is deterministic for the same input", () => {
    const now = new Date("2026-11-07T10:00:00.000Z");
    const replies = [{ body: "answer", isStaffReply: true }];

    expect(buildSearchFieldUpdate(issue, replies, new Map(), now)).toEqual(
      buildSearchFieldUpdate(issue, replies, new Map(), now),
    );
  });

  it("rebuilds from source, so removed replies disappear", () => {
    const withReply = buildSearchFieldUpdate(
      issue,
      [{ body: "temporary answer", isStaffReply: true }],
      new Map(),
    );
    const withoutReply = buildSearchFieldUpdate(issue, [], new Map());

    expect(withReply.publicSearchText).toContain("temporary answer");
    expect(withoutReply.publicSearchText).not.toContain("temporary answer");
  });
});
