import { describe, expect, it } from "vitest";

import {
  DEFAULT_ISSUE_FILTERS,
  ISSUES_PATH,
  buildIssueDetailHref,
  buildIssueEditHref,
  buildIssueListHref,
  hasActiveIssueFilters,
  parseIssueListFilters,
  parseIssueListReturnTo,
  sanitizeIssueListReturnTo,
  toIssueDateRange,
} from "@/lib/issue-list-params";

const staff = { canManage: true };
const student = { canManage: false };

describe("parseIssueListFilters", () => {
  it("returns the default view for empty search params", () => {
    expect(parseIssueListFilters(undefined, staff)).toEqual({
      ...DEFAULT_ISSUE_FILTERS,
      sort: "answer",
      page: 1,
    });
    expect(parseIssueListFilters(undefined, student)).toEqual({
      ...DEFAULT_ISSUE_FILTERS,
      page: 1,
    });
  });

  it("keeps the values the list page and service understand", () => {
    const filters = parseIssueListFilters(
      {
        q: "  upload fails  ",
        status: "OPEN",
        tag: "video",
        courseSlug: "react-beginner",
        batchNo: "7",
        mentorId: "64b7f0c2c1a4e8f0a1b2c3d4",
        from: "2026-01-01",
        to: "2026-01-31",
        sort: "oldest",
        page: "3",
      },
      staff,
    );

    expect(filters).toEqual({
      q: "upload fails",
      status: "OPEN",
      tag: "video",
      courseSlug: "react-beginner",
      batchNo: "7",
      mentorId: "64b7f0c2c1a4e8f0a1b2c3d4",
      from: "2026-01-01",
      to: "2026-01-31",
      sort: "oldest",
      page: 3,
    });
  });

  it("drops values that are not part of the allowlist", () => {
    const filters = parseIssueListFilters(
      {
        status: "NOPE",
        batchNo: "seven",
        from: "01-01-2026",
        to: "yesterday",
        sort: "random",
        page: "abc",
      },
      staff,
    );

    expect(filters.status).toBe("");
    expect(filters.batchNo).toBe("");
    expect(filters.from).toBe("");
    expect(filters.to).toBe("");
    expect(filters.sort).toBe("answer");
    expect(filters.page).toBe(1);
  });

  it("keeps the student default on newest", () => {
    expect(parseIssueListFilters({ sort: "random" }, student).sort).toBe("newest");
    expect(parseIssueListFilters({ sort: "answer" }, student).sort).toBe("newest");
    expect(parseIssueListFilters({ sort: "answer" }, staff).sort).toBe("answer");
  });

  it("rejects a date that parses but is not a real day", () => {
    expect(parseIssueListFilters({ from: "2026-02-30", to: "2026-13-01" }, staff)).toMatchObject({
      from: "",
      to: "",
    });
    expect(parseIssueListFilters({ from: "2026-02-28" }, staff).from).toBe("2026-02-28");
  });

  it("never hands a student the staff mentor filter", () => {
    const filters = parseIssueListFilters(
      { mentorId: "64b7f0c2c1a4e8f0a1b2c3d4", status: "OPEN" },
      student,
    );

    expect(filters.mentorId).toBe("");
    expect(filters.status).toBe("OPEN");
  });

  it("clamps the page into a safe range", () => {
    expect(parseIssueListFilters({ page: "0" }, staff).page).toBe(1);
    expect(parseIssueListFilters({ page: "-4" }, staff).page).toBe(1);
    expect(parseIssueListFilters({ page: "999999999" }, staff).page).toBe(10_000);
    expect(parseIssueListFilters({ page: "2.9" }, staff).page).toBe(1);
  });

  it("uses the first value when a key repeats", () => {
    const filters = parseIssueListFilters({ status: ["OPEN", "SOLVED"] }, staff);
    expect(filters.status).toBe("OPEN");
  });

  it("caps an oversized keyword", () => {
    const filters = parseIssueListFilters({ q: "a".repeat(500) }, staff);
    expect(filters.q).toHaveLength(200);
  });
});

describe("buildIssueListHref", () => {
  it("keeps the canonical list URL clean", () => {
    expect(
      buildIssueListHref({ ...DEFAULT_ISSUE_FILTERS, page: 1 }),
    ).toBe(ISSUES_PATH);
  });

  it("drops defaults but keeps real filters and the page", () => {
    const href = buildIssueListHref({
      ...DEFAULT_ISSUE_FILTERS,
      status: "OPEN",
      sort: "oldest",
      q: "upload",
      page: 3,
    });

    expect(href).toBe(`${ISSUES_PATH}?q=upload&status=OPEN&sort=oldest&page=3`);
  });

  it("omits the role-specific default sort but keeps an explicit one", () => {
    const now = { ...DEFAULT_ISSUE_FILTERS, page: 1 };

    expect(buildIssueListHref({ ...now, sort: "answer" }, { defaultSort: "answer" })).toBe(
      ISSUES_PATH,
    );
    expect(buildIssueListHref({ ...now, sort: "newest" }, { defaultSort: "answer" })).toBe(
      `${ISSUES_PATH}?sort=newest`,
    );
    expect(buildIssueListHref({ ...now, sort: "answer" })).toBe(`${ISSUES_PATH}?sort=answer`);
  });

  it("encodes values instead of letting them break the query", () => {
    const href = buildIssueListHref({
      ...DEFAULT_ISSUE_FILTERS,
      q: "a&b=c",
      page: 1,
    });

    expect(href).toBe(`${ISSUES_PATH}?q=a%26b%3Dc`);
  });

  it("lets the caller override the page", () => {
    const href = buildIssueListHref(
      { ...DEFAULT_ISSUE_FILTERS, status: "OPEN", page: 3 },
      { page: 4 },
    );

    expect(href).toBe(`${ISSUES_PATH}?status=OPEN&page=4`);
  });
});

describe("detail and edit hrefs", () => {
  it("adds the list context only when there is one", () => {
    expect(buildIssueDetailHref("abc123")).toBe(`${ISSUES_PATH}/abc123`);
    expect(buildIssueDetailHref("abc123", `${ISSUES_PATH}?page=3`)).toBe(
      `${ISSUES_PATH}/abc123?returnTo=%2Fdashboard%2Fissues%3Fpage%3D3`,
    );
    expect(buildIssueEditHref("abc123", `${ISSUES_PATH}?page=3`)).toBe(
      `${ISSUES_PATH}/abc123/edit?returnTo=%2Fdashboard%2Fissues%3Fpage%3D3`,
    );
  });
});

describe("parseIssueListReturnTo", () => {
  it("accepts the internal list pages", () => {
    expect(parseIssueListReturnTo(`${ISSUES_PATH}?status=OPEN&page=3`, staff)).toBe(
      `${ISSUES_PATH}?status=OPEN&page=3`,
    );
    expect(parseIssueListReturnTo("/dashboard", staff)).toBe("/dashboard");
    expect(parseIssueListReturnTo("/dashboard/my-requests", staff)).toBe(
      "/dashboard/my-requests",
    );
  });

  it("rebuilds the URL from allowlisted filters only", () => {
    // Unknown keys, absolute URLs and defaults never survive the rebuild.
    // `newest` is an explicit choice for staff (their default is `answer`).
    expect(
      parseIssueListReturnTo(
        `${ISSUES_PATH}?page=1&sort=newest&next=https%3A%2F%2Fevil.test`,
        staff,
      ),
    ).toBe(`${ISSUES_PATH}?sort=newest`);
    expect(
      parseIssueListReturnTo(
        `${ISSUES_PATH}?page=1&sort=answer&next=https%3A%2F%2Fevil.test`,
        staff,
      ),
    ).toBe(ISSUES_PATH);
  });

  it("rejects everything that is not a known internal path", () => {
    for (const value of [
      "https://evil.test",
      "//evil.test/dashboard/issues",
      "/\\evil.test",
      "/dashboardx",
      "/dashboard/issues/../admin",
      "javascript:alert(1)",
      "dashboard/issues",
      "",
      "a".repeat(600),
      null,
      undefined,
      42,
      ["https://evil.test"],
    ]) {
      expect(parseIssueListReturnTo(value, staff)).toBeNull();
    }
  });

  it("refuses to echo header-injection attempts", () => {
    expect(
      parseIssueListReturnTo(`${ISSUES_PATH}%0d%0aSet-Cookie:%20a=b`, staff),
    ).toBeNull();
  });

  it("strips the staff mentor filter for students", () => {
    expect(
      parseIssueListReturnTo(
        `${ISSUES_PATH}?status=OPEN&mentorId=64b7f0c2c1a4e8f0a1b2c3d4`,
        student,
      ),
    ).toBe(`${ISSUES_PATH}?status=OPEN`);
  });

  it("falls back to the plain list when sanitizing", () => {
    expect(sanitizeIssueListReturnTo("https://evil.test", staff)).toBe(ISSUES_PATH);
    expect(sanitizeIssueListReturnTo(`${ISSUES_PATH}?page=2`, staff)).toBe(
      `${ISSUES_PATH}?page=2`,
    );
  });
});

describe("toIssueDateRange", () => {
  it("turns calendar days into inclusive ISO bounds", () => {
    expect(toIssueDateRange({ from: "2026-01-01", to: "2026-01-31" })).toEqual({
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-01-31T23:59:59.999Z",
    });
  });

  it("omits empty bounds", () => {
    expect(toIssueDateRange({ from: "", to: "" })).toEqual({
      from: undefined,
      to: undefined,
    });
  });
});

describe("hasActiveIssueFilters", () => {
  it("is false only for the default view", () => {
    expect(hasActiveIssueFilters(DEFAULT_ISSUE_FILTERS)).toBe(false);
    expect(
      hasActiveIssueFilters({ ...DEFAULT_ISSUE_FILTERS, sort: "answer" }, "answer"),
    ).toBe(false);
    expect(hasActiveIssueFilters({ ...DEFAULT_ISSUE_FILTERS, sort: "oldest" })).toBe(true);
    expect(
      hasActiveIssueFilters({ ...DEFAULT_ISSUE_FILTERS, sort: "newest" }, "answer"),
    ).toBe(true);
    expect(hasActiveIssueFilters({ ...DEFAULT_ISSUE_FILTERS, tag: "video" })).toBe(true);
  });
});
