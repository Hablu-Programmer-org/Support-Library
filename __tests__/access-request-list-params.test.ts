import { describe, expect, it } from "vitest";

import {
  ACCESS_REQUESTS_PATH,
  accessQueueStatuses,
  buildAccessRequestHref,
  DEFAULT_ACCESS_REQUEST_STATE,
  parseAccessRequestListState,
} from "@/lib/access-request-list-params";

describe("parseAccessRequestListState", () => {
  it("defaults to the OpenAI tab with no search and sent hidden", () => {
    expect(parseAccessRequestListState(undefined)).toEqual(DEFAULT_ACCESS_REQUEST_STATE);
    expect(parseAccessRequestListState({})).toEqual(DEFAULT_ACCESS_REQUEST_STATE);
  });

  it("reads a valid tab, search, sent toggle and page", () => {
    expect(
      parseAccessRequestListState({ tab: "n8n", q: " Student@Example.com ", sent: "1", page: "3" }),
    ).toEqual({ tab: "n8n", q: "student@example.com", showSent: true, page: 3 });
  });

  it("drops invalid values instead of forwarding them", () => {
    expect(
      parseAccessRequestListState({ tab: "billing", q: "", sent: "yes", page: "abc" }),
    ).toEqual(DEFAULT_ACCESS_REQUEST_STATE);
    expect(parseAccessRequestListState({ page: "0" }).page).toBe(1);
    expect(parseAccessRequestListState({ page: "-4" }).page).toBe(1);
  });

  it("clamps an absurd page instead of building a huge skip", () => {
    expect(parseAccessRequestListState({ page: "999999999999" }).page).toBe(10_000);
  });

  it("caps the email search length", () => {
    const q = "a".repeat(400);
    expect(parseAccessRequestListState({ q }).q).toHaveLength(120);
  });

  it("keeps the first value when a param is repeated", () => {
    expect(parseAccessRequestListState({ tab: ["n8n", "openai"] }).tab).toBe("n8n");
  });
});

describe("buildAccessRequestHref", () => {
  it("returns the plain path for the default view", () => {
    expect(buildAccessRequestHref(DEFAULT_ACCESS_REQUEST_STATE)).toBe(ACCESS_REQUESTS_PATH);
  });

  it("carries tab, search, sent toggle and page", () => {
    expect(
      buildAccessRequestHref({
        tab: "n8n",
        q: "student@example.com",
        showSent: true,
        page: 2,
      }),
    ).toBe(
      `${ACCESS_REQUESTS_PATH}?tab=n8n&q=student%40example.com&sent=1&page=2`,
    );
  });

  it("applies an override without mutating the state", () => {
    const state = { tab: "openai" as const, q: "a@b.com", showSent: true, page: 4 };
    expect(buildAccessRequestHref(state, { page: 1 })).toBe(
      `${ACCESS_REQUESTS_PATH}?q=a%40b.com&sent=1`,
    );
    expect(state.page).toBe(4);
  });

  it("round-trips through the parser", () => {
    const state = { tab: "n8n" as const, q: "a@b.com", showSent: true, page: 3 };
    expect(parseAccessRequestListState(
      Object.fromEntries(new URL(buildAccessRequestHref(state), "http://x").searchParams),
    )).toEqual(state);
  });
});

describe("accessQueueStatuses", () => {
  it("shows active work by default and adds sent rows only when asked", () => {
    expect(accessQueueStatuses(false)).toEqual(["PENDING", "FAILED", "PROCESSING"]);
    expect(accessQueueStatuses(true)).toEqual(["PENDING", "FAILED", "PROCESSING", "SENT", "REJECTED"]);
  });
});
