import { describe, expect, it } from "vitest";

import { projectRepliesForViewer } from "@/lib/reply-view";
import type { SupportReplyListItem } from "@/lib/services/replies";

const upload = {
  id: "66f1a2b3c4d5e6f7a8b9c0d1",
  originalName: "screenshot.png",
  mimeType: "image/png",
  byteSize: 1024,
  width: 800,
  height: 600,
};

const reply = (
  overrides: Partial<SupportReplyListItem> & Pick<SupportReplyListItem, "id" | "authorId">,
): SupportReplyListItem => ({
  issueId: "66f1a2b3c4d5e6f7a8b9c0d2",
  authorName: "Someone",
  isStaffReply: false,
  body: "text",
  videoLinks: [],
  uploads: [upload],
  ...overrides,
});

const staffReply = reply({
  id: "r1",
  authorId: "mentor-1",
  authorName: "Mentor",
  isStaffReply: true,
});
const ownReply = reply({ id: "r2", authorId: "student-1" });
const otherReply = reply({ id: "r3", authorId: "student-2" });

describe("reply view projection", () => {
  it("returns the untouched thread for staff", () => {
    const result = projectRepliesForViewer(
      [staffReply, ownReply, otherReply],
      "staff",
      "mentor-1",
    );
    expect(result).toHaveLength(3);
    expect(result[2].authorId).toBe("student-2");
  });

  it("shows the owner the team's answers and their own follow-ups only", () => {
    const result = projectRepliesForViewer(
      [staffReply, ownReply, otherReply],
      "owner",
      "student-1",
    );
    expect(result.map((item) => item.id)).toEqual(["r1", "r2"]);
    expect(result.every((item) => item.authorId === "")).toBe(true);
    // The team's images stay visible on the owner's own case.
    expect(result[0].uploads).toHaveLength(1);
  });

  it("hides every student follow-up from the owner when the author is unknown", () => {
    const result = projectRepliesForViewer(
      [staffReply, otherReply],
      "owner",
      undefined,
    );
    expect(result.map((item) => item.id)).toEqual(["r1"]);
  });

  it("shows every reply in the published library without author identity", () => {
    const result = projectRepliesForViewer(
      [staffReply, ownReply, otherReply],
      "public",
    );
    expect(result.map((item) => item.id)).toEqual(["r1", "r2", "r3"]);
    expect(result.every((item) => item.authorId === "")).toBe(true);
    expect(result.every((item) => item.authorName === undefined)).toBe(true);
    // Evidence images are part of the reviewed solution.
    expect(result.every((item) => item.uploads.length === 1)).toBe(true);
  });
});
