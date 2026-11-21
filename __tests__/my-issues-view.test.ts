import { describe, expect, it } from "vitest";

import { CASE_STATUSES } from "@/lib/constants";
import {
  filterMyIssues,
  groupMyIssues,
  parseMyIssuesView,
  statusGroup,
} from "@/lib/my-issues-view";

describe("statusGroup", () => {
  it("puts each status in its bucket", () => {
    expect(statusGroup("AWAITING_STUDENT")).toBe("action");
    expect(statusGroup("OPEN")).toBe("active");
    expect(statusGroup("PENDING")).toBe("active");
    expect(statusGroup("FOLLOW_UP")).toBe("active");
    expect(statusGroup("SOLVED")).toBe("closed");
    expect(statusGroup("ARCHIVED")).toBe("closed");
  });

  it("covers every CASE_STATUSES value", () => {
    for (const status of CASE_STATUSES) {
      expect(["action", "active", "closed"]).toContain(statusGroup(status));
    }
  });

  it("keeps an unknown or prototype-key status visible as active", () => {
    expect(statusGroup("LEGACY_STATE")).toBe("active");
    expect(statusGroup("constructor")).toBe("active");
    expect(statusGroup("__proto__")).toBe("active");
    expect(statusGroup("")).toBe("active");
  });
});

describe("parseMyIssuesView", () => {
  it("accepts the whitelisted views", () => {
    expect(parseMyIssuesView("all")).toBe("all");
    expect(parseMyIssuesView("action")).toBe("action");
    expect(parseMyIssuesView("active")).toBe("active");
    expect(parseMyIssuesView("closed")).toBe("closed");
  });

  it("falls back to all for missing, unknown or hostile input", () => {
    expect(parseMyIssuesView(undefined)).toBe("all");
    expect(parseMyIssuesView("")).toBe("all");
    expect(parseMyIssuesView("xyz")).toBe("all");
    expect(parseMyIssuesView("ACTION")).toBe("all");
    expect(parseMyIssuesView(" closed")).toBe("all");
    expect(parseMyIssuesView("<script>alert(1)</script>")).toBe("all");
    expect(parseMyIssuesView("constructor")).toBe("all");
  });

  it("uses the first value when the param repeats", () => {
    expect(parseMyIssuesView(["closed", "action"])).toBe("closed");
    expect(parseMyIssuesView(["nope", "closed"])).toBe("all");
    expect(parseMyIssuesView([])).toBe("all");
  });
});

describe("groupMyIssues / filterMyIssues", () => {
  const issues = [
    { id: "a", status: "AWAITING_STUDENT" },
    { id: "b", status: "OPEN" },
    { id: "c", status: "SOLVED" },
    { id: "d", status: "FOLLOW_UP" },
    { id: "e", status: "ARCHIVED" },
  ];

  it("counts each bucket from the same list", () => {
    expect(groupMyIssues(issues)).toEqual({ all: 5, action: 1, active: 2, closed: 2 });
  });

  it("returns zeros for an empty list", () => {
    expect(groupMyIssues([])).toEqual({ all: 0, action: 0, active: 0, closed: 0 });
    expect(filterMyIssues([], "action")).toEqual([]);
  });

  it("filters by view and keeps the incoming order", () => {
    expect(filterMyIssues(issues, "active").map((i) => i.id)).toEqual(["b", "d"]);
    expect(filterMyIssues(issues, "closed").map((i) => i.id)).toEqual(["c", "e"]);
    expect(filterMyIssues(issues, "action").map((i) => i.id)).toEqual(["a"]);
    expect(filterMyIssues(issues, "all").map((i) => i.id)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("filtered counts always add up to the total", () => {
    const counts = groupMyIssues(issues);
    expect(counts.action + counts.active + counts.closed).toBe(counts.all);
    expect(filterMyIssues(issues, "active")).toHaveLength(counts.active);
  });

  it("does not mutate the input for the all view", () => {
    const copy = filterMyIssues(issues, "all");
    copy.pop();
    expect(issues).toHaveLength(5);
  });
});
