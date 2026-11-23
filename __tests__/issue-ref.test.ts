import { describe, expect, it } from "vitest";

import { buildIssueDetailHref, buildIssueEditHref, ISSUES_PATH } from "@/lib/issue-list-params";
import { isCaseRef, isObjectIdKey, issueUrlKey } from "@/lib/issue-ref";

const ID = "6512f3a4b5c6d7e8f9a0b1c2";

describe("issue URL keys", () => {
  it("recognises a six-digit reference and nothing else", () => {
    expect(isCaseRef("000123")).toBe(true);
    expect(isCaseRef("12345")).toBe(false);
    expect(isCaseRef("1234567")).toBe(false);
    expect(isCaseRef("00012a")).toBe(false);
    expect(isCaseRef("new")).toBe(false);
  });

  it("recognises a 24-hex id and nothing else", () => {
    expect(isObjectIdKey(ID)).toBe(true);
    expect(isObjectIdKey("000123")).toBe(false);
    expect(isObjectIdKey(`${ID}0`)).toBe(false);
    expect(isObjectIdKey("zz12f3a4b5c6d7e8f9a0b1c2")).toBe(false);
  });

  it("uses the reference when the issue has one, else the id", () => {
    expect(issueUrlKey({ id: ID, caseRef: "000123" })).toBe("000123");
    expect(issueUrlKey({ id: ID, caseRef: null })).toBe(ID);
    expect(issueUrlKey({ id: ID })).toBe(ID);
    // A malformed stored value never reaches the URL.
    expect(issueUrlKey({ id: ID, caseRef: "HSL-1042" })).toBe(ID);
    expect(issueUrlKey(ID)).toBe(ID);
  });

  it("builds detail and edit hrefs from the issue", () => {
    const issue = { id: ID, caseRef: "000123" };
    expect(buildIssueDetailHref(issue)).toBe(`${ISSUES_PATH}/000123`);
    expect(buildIssueEditHref(issue, `${ISSUES_PATH}?page=3`)).toBe(
      `${ISSUES_PATH}/000123/edit?returnTo=%2Fdashboard%2Fissues%3Fpage%3D3`,
    );
    expect(buildIssueDetailHref({ id: ID, caseRef: null })).toBe(`${ISSUES_PATH}/${ID}`);
  });
});
