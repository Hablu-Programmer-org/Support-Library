import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import IssueDetailLoading from "@/app/dashboard/issues/[id]/loading";
import NewIssueLoading from "@/app/dashboard/issues/new/loading";

describe("issue page skeletons", () => {
  it.each([
    ["create page", NewIssueLoading],
    ["case page", IssueDetailLoading],
  ])("the %s skeleton is busy, labelled and uses no spinner", (_, Loading) => {
    const { container } = render(<Loading />);
    const root = container.firstElementChild!;
    expect(root.getAttribute("aria-busy")).toBe("true");
    expect(root.getAttribute("aria-label")).toBe("Loading");
    expect(container.querySelector('[role="progressbar"], .animate-spin')).toBeNull();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(5);
    expect(container.textContent).toBe("");
  });
});
