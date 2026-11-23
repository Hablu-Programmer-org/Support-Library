import { describe, expect, it } from "vitest";

import {
  clearIssueDraft,
  isEmptyIssueDraft,
  ISSUE_DRAFT_MAX_AGE_MS,
  issueDraftKey,
  readIssueDraft,
  writeIssueDraft,
  type IssueDraftFields,
} from "@/lib/issue-draft";
import { issueTemplateMarkdown } from "@/lib/issue-template";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

const empty: IssueDraftFields = {
  title: "",
  question: "",
  courseSlug: "",
  moduleSlug: "",
  contentSlug: "",
  tags: "",
  videoLinks: "",
};
const fields: IssueDraftFields = { ...empty, title: "Blank page", question: "**Bold** detail", courseSlug: "web" };
const key = issueDraftKey("user-1");
const now = 1_800_000_000_000;

describe("issue drafts", () => {
  it("is keyed per account", () => {
    expect(issueDraftKey("a")).not.toBe(issueDraftKey("b"));
  });

  it("round-trips the fields with the save time", () => {
    const storage = memoryStorage();
    writeIssueDraft(key, fields, now, storage);
    expect(readIssueDraft(key, now + 1000, storage)).toEqual({ ...fields, savedAt: now });
  });

  it("removes the draft instead of saving an empty or template-only form", () => {
    const storage = memoryStorage();
    writeIssueDraft(key, fields, now, storage);
    writeIssueDraft(key, { ...empty, question: issueTemplateMarkdown }, now, storage);
    expect(storage.data.has(key)).toBe(false);
    expect(isEmptyIssueDraft({ ...empty, title: "  " })).toBe(true);
    expect(isEmptyIssueDraft({ ...empty, tags: "react" })).toBe(false);
  });

  it("forgets drafts older than a week, or dated in the future", () => {
    const storage = memoryStorage();
    writeIssueDraft(key, fields, now, storage);
    expect(readIssueDraft(key, now + ISSUE_DRAFT_MAX_AGE_MS + 1, storage)).toBeNull();
    expect(storage.data.has(key)).toBe(false);

    writeIssueDraft(key, fields, now + 10 * 60_000, storage);
    expect(readIssueDraft(key, now, storage)).toBeNull();
  });

  it("treats malformed, mistyped or oversized data as no draft", () => {
    const storage = memoryStorage();
    for (const raw of [
      "not json",
      "null",
      JSON.stringify({ title: "x" }),
      JSON.stringify({ ...fields, savedAt: now, title: 42 }),
      JSON.stringify({ ...fields, savedAt: now, question: "x".repeat(50_000) }),
    ]) {
      storage.data.set(key, raw);
      expect(readIssueDraft(key, now, storage)).toBeNull();
    }
  });

  it("ignores unknown keys and fills missing optional fields with empty strings", () => {
    const storage = memoryStorage();
    storage.data.set(key, JSON.stringify({ savedAt: now, title: "Only a title", extra: "<script>" }));
    expect(readIssueDraft(key, now, storage)).toEqual({ ...empty, title: "Only a title", savedAt: now });
  });

  it("never throws when storage is blocked or full", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new DOMException("quota", "QuotaExceededError");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => writeIssueDraft(key, fields, now, broken)).not.toThrow();
    expect(readIssueDraft(key, now, broken)).toBeNull();
    expect(() => clearIssueDraft(key, broken)).not.toThrow();
  });
});
