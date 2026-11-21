import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import IssuesLoading from "@/app/dashboard/issues/loading";
import {
  IssueCard,
  issueCardEnterDelay,
  ISSUE_CARD_STAGGER_MS,
  ISSUE_CARD_STAGGER_STEPS,
} from "@/components/issues/issue-card";

describe("issueCardEnterDelay", () => {
  it("starts the first card at once and steps the next ones", () => {
    expect(issueCardEnterDelay(0)).toBe(0);
    expect(issueCardEnterDelay(1)).toBe(ISSUE_CARD_STAGGER_MS);
    expect(issueCardEnterDelay(3)).toBe(3 * ISSUE_CARD_STAGGER_MS);
  });

  it("caps the delay so a long page never drags", () => {
    const cap = (ISSUE_CARD_STAGGER_STEPS - 1) * ISSUE_CARD_STAGGER_MS;
    expect(issueCardEnterDelay(ISSUE_CARD_STAGGER_STEPS - 1)).toBe(cap);
    expect(issueCardEnterDelay(19)).toBe(cap);
    expect(issueCardEnterDelay(1_000_000)).toBe(cap);
    expect(cap).toBeLessThanOrEqual(320);
  });

  it("treats bad input as no delay", () => {
    expect(issueCardEnterDelay(-3)).toBe(0);
    expect(issueCardEnterDelay(Number.NaN)).toBe(0);
    expect(issueCardEnterDelay(Number.POSITIVE_INFINITY)).toBe(0);
    expect(issueCardEnterDelay(2.9)).toBe(2 * ISSUE_CARD_STAGGER_MS);
  });
});

describe("IssueCard entrance", () => {
  const card = {
    href: "/dashboard/issues/1",
    title: "Title",
    question: "Question",
    status: "OPEN" as const,
    tags: [],
  };

  it("carries the CSS animation class and its delay", () => {
    render(<IssueCard {...card} enterIndex={2} />);
    const article = screen.getByTestId("issue-card");
    expect(article.className).toContain("issue-card-in");
    expect(article.style.getPropertyValue("--issue-card-delay")).toBe(`${2 * ISSUE_CARD_STAGGER_MS}ms`);
  });

  it("defaults to no delay", () => {
    render(<IssueCard {...card} />);
    expect(screen.getByTestId("issue-card").style.getPropertyValue("--issue-card-delay")).toBe("0ms");
  });
});

describe("IssuesLoading", () => {
  it("is a busy skeleton shaped like the card list, with no spinner text", () => {
    const { container } = render(<IssuesLoading />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getAllByTestId("issue-card-skeleton")).toHaveLength(6);
    expect(screen.queryByText(/loading/i)).toBeNull();
  });
});
