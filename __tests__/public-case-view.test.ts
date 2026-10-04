import { describe, expect, it } from "vitest";

import { toPublicCaseView } from "@/lib/public-case-view";
import type { SupportCaseListItem } from "@/lib/services/cases";
import type { SupportReplyListItem } from "@/lib/services/replies";

describe("public case view", () => {
  const supportCase: SupportCaseListItem = {
    id: "case-1",
    studentRefId: "student-1",
    studentName: "Private Student",
    studentEmail: "private@example.com",
    studentId: "HP-001",
    title: "React image problem",
    question: "Image not rendering",
    status: "OPEN",
    priority: "NORMAL",
    tags: ["react", "image"],
  };

  const replies: SupportReplyListItem[] = [
    {
      id: "reply-1",
      caseId: "case-1",
      authorId: "staff-1",
      authorName: "Mentor",
      body: "Use /image.png from public folder.",
      isInternalNote: false,
      fileLinks: [{ title: "Screenshot", url: "https://example.com/shot.png" }],
      videoLinks: [],
    },
    {
      id: "reply-2",
      caseId: "case-1",
      authorId: "staff-2",
      authorName: "Admin",
      body: "Private staff-only note about student behavior.",
      isInternalNote: true,
      fileLinks: [{ title: "Internal", url: "https://example.com/internal" }],
      videoLinks: [{ title: "Internal video", url: "https://example.com/video" }],
    },
  ];

  it("removes student identity and internal notes", () => {
    const view = toPublicCaseView(supportCase, replies);
    const serialized = JSON.stringify(view);

    expect(serialized).not.toContain("Private Student");
    expect(serialized).not.toContain("private@example.com");
    expect(serialized).not.toContain("HP-001");
    expect(serialized).not.toContain("Private staff-only note");
    expect(serialized).not.toContain("Internal video");
    expect(view.replies).toHaveLength(1);
    expect(view.replies[0].body).toContain("public folder");
  });
});
