import { describe, expect, it } from "vitest";

import { maskEmail, parseBulkAccessInput } from "@/lib/bulk-access-input";

describe("parseBulkAccessInput", () => {
  it("normalizes and deduplicates valid emails", () => {
    const result = parseBulkAccessInput(" Student@Example.com \nstudent@example.com\n");

    expect(result.emails).toEqual(["student@example.com"]);
    expect(result.duplicateCount).toBe(1);
  });

  it("separates names and malformed email-like rows", () => {
    const result = parseBulkAccessInput("Md Student\nnusrat@gmail. Com\nmahin 1@gmail.com");

    expect(result.names).toEqual(["Md Student"]);
    expect(result.invalid).toEqual(["nusrat@gmail. Com", "mahin 1@gmail.com"]);
  });

  it("ignores comments, blanks, and invisible characters", () => {
    const result = parseBulkAccessInput("# import\n\n\u200Buser@example.com\uFEFF");

    expect(result.emails).toEqual(["user@example.com"]);
  });
});

describe("maskEmail", () => {
  it("does not expose the email local part", () => {
    expect(maskEmail("student@example.com")).toBe("s***@example.com");
  });
});
