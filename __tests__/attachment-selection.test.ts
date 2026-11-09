import { describe, expect, it } from "vitest";

import {
  DEFAULT_MAX_FILES,
  describeMerge,
  fileKey,
  isAcceptedImageType,
  mergeFileSelection,
  type SelectableFile,
} from "@/lib/uploads/selection";

const image = (name: string, extra: Partial<SelectableFile> = {}): SelectableFile => ({
  name,
  size: 1024,
  lastModified: 1_700_000_000_000,
  type: "image/png",
  ...extra,
});

describe("mergeFileSelection", () => {
  it("adds a second selection to the first instead of replacing it", () => {
    const first = mergeFileSelection({ existing: [], incoming: [image("a.png"), image("b.png")] });
    const second = mergeFileSelection({ existing: first.files, incoming: [image("c.png")] });

    expect(second.files.map((file) => file.name)).toEqual(["a.png", "b.png", "c.png"]);
    expect(second.overflow).toBe(0);
  });

  it("skips a file that is already selected", () => {
    const first = mergeFileSelection({ existing: [], incoming: [image("a.png")] });
    const second = mergeFileSelection({ existing: first.files, incoming: [image("a.png")] });

    expect(second.files).toHaveLength(1);
    expect(second.duplicates).toBe(1);
  });

  it("treats files with the same name but a different size or time as distinct", () => {
    const first = mergeFileSelection({ existing: [], incoming: [image("screenshot.png")] });
    const second = mergeFileSelection({
      existing: first.files,
      incoming: [
        image("screenshot.png", { size: 2048 }),
        image("screenshot.png", { lastModified: 1_700_000_001_000 }),
      ],
    });

    expect(second.files).toHaveLength(3);
    expect(second.duplicates).toBe(0);
  });

  it("caps the field at the budget and reports the overflow", () => {
    const incoming = Array.from({ length: 7 }, (_, index) => image(`shot-${index}.png`));
    const result = mergeFileSelection({ existing: [], incoming, maxFiles: 5 });

    expect(result.files).toHaveLength(5);
    expect(result.overflow).toBe(2);
  });

  it("counts files against the remaining budget when images are already saved", () => {
    const result = mergeFileSelection({
      existing: [],
      incoming: [image("a.png"), image("b.png"), image("c.png")],
      maxFiles: 2, // 5 total cap - 3 already saved on the issue
    });

    expect(result.files).toHaveLength(2);
    expect(result.overflow).toBe(1);
  });

  it("drops a clearly unsupported type but keeps one with no declared type", () => {
    const result = mergeFileSelection({
      existing: [],
      incoming: [
        image("notes.pdf", { type: "application/pdf" }),
        image("scan.png", { type: "" }),
      ],
    });

    expect(result.files.map((file) => file.name)).toEqual(["scan.png"]);
    expect(result.rejectedType).toBe(1);
  });

  it("defaults to the five-image budget", () => {
    expect(DEFAULT_MAX_FILES).toBe(5);
  });
});

describe("describeMerge", () => {
  it("stays quiet when every file was accepted", () => {
    const result = mergeFileSelection({ existing: [], incoming: [image("a.png")] });
    expect(describeMerge(result, 5)).toBeNull();
  });

  it("explains each rejection in the server's wording", () => {
    const result = mergeFileSelection({
      existing: [],
      incoming: [
        image("a.png"),
        image("a.png"),
        image("notes.pdf", { type: "application/pdf" }),
      ],
      maxFiles: 1,
    });

    const message = describeMerge(result, 1);
    expect(message).toContain("only PNG, JPEG, GIF or WebP images can be attached");
    expect(message).toContain("already selected");
  });
});

describe("fileKey and isAcceptedImageType", () => {
  it("uses name, size and modification time as identity", () => {
    expect(fileKey(image("a.png"))).toBe(fileKey(image("a.png")));
    expect(fileKey(image("a.png"))).not.toBe(fileKey(image("a.png", { size: 2 })));
  });

  it("accepts the four image formats the server sniffs", () => {
    expect(isAcceptedImageType(image("a.png", { type: "image/png" }))).toBe(true);
    expect(isAcceptedImageType(image("a.jpg", { type: "image/jpeg" }))).toBe(true);
    expect(isAcceptedImageType(image("a.webp", { type: "image/webp" }))).toBe(true);
    expect(isAcceptedImageType(image("a.gif", { type: "image/gif" }))).toBe(true);
    expect(isAcceptedImageType(image("a.svg", { type: "image/svg+xml" }))).toBe(false);
  });
});
