import { describe, expect, it } from "vitest";

import { canDownloadAttachment, type AttachmentAccessInput } from "@/lib/attachment-access";

const base: AttachmentAccessInput = {
  viewerId: "student-2",
  isStaff: false,
  uploaderId: "student-1",
  ownerId: "student-1",
  parentVisibility: "INTERNAL",
};

describe("attachment download access", () => {
  it("always allows staff", () => {
    expect(canDownloadAttachment({ ...base, isStaff: true })).toBe(true);
  });

  it("allows the uploader to read their own file", () => {
    expect(
      canDownloadAttachment({ ...base, viewerId: "student-1" }),
    ).toBe(true);
  });

  it("allows the case owner to read the team's images on their own case", () => {
    expect(
      canDownloadAttachment({
        ...base,
        viewerId: "student-5",
        ownerId: "student-5",
      }),
    ).toBe(true);
  });

  it("allows any signed-in student once the case is published", () => {
    expect(
      canDownloadAttachment({ ...base, parentVisibility: "PUBLISHED" }),
    ).toBe(true);
  });

  it("denies an unrelated student while the case is internal", () => {
    expect(canDownloadAttachment(base)).toBe(false);
  });

  it("never matches on empty ids", () => {
    expect(
      canDownloadAttachment({
        ...base,
        viewerId: "",
        uploaderId: "",
        ownerId: "",
      }),
    ).toBe(false);
  });
});
