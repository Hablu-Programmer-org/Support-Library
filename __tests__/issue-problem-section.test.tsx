import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IssueProblemSection } from "@/components/issues/issue-problem-section";
import { RichText } from "@/lib/rich-text";

const renderSection = (
  question: string,
  extra: Partial<Parameters<typeof IssueProblemSection>[0]> = {},
) =>
  render(
    <IssueProblemSection
      question={question}
      videoLinks={[]}
      uploads={[]}
      tags={[]}
      {...extra}
    />,
  );

describe("IssueProblemSection markdown", () => {
  it("shows the 'Issue details' heading the e2e suite looks for", () => {
    renderSection("plain question");
    expect(screen.getByRole("heading", { level: 2, name: "Issue details" })).toBeTruthy();
  });

  it("renders a pasted markdown issue as real elements", () => {
    const { container } = renderSection(
      [
        "## Error",
        "",
        "```js",
        "console.log(x)",
        "```",
        "",
        "- step 1",
        "- step 2",
        "",
        "| a | b |",
        "| --- | --- |",
        "| 1 | 2 |",
        "",
        "> quoted",
        "",
        "Some **bold** text",
      ].join("\n"),
    );

    expect(container.querySelector("h2:not(#problem-heading)")?.textContent).toBe("Error");
    expect(container.querySelector("pre code")?.textContent).toBe("console.log(x)");
    expect(Array.from(container.querySelectorAll("ul:not([aria-label]) li")).map((li) => li.textContent)).toEqual([
      "step 1",
      "step 2",
    ]);
    expect(container.querySelector("table td")?.textContent).toBe("1");
    expect(container.querySelector("blockquote")?.textContent).toBe("quoted");
    expect(container.querySelector("strong")?.textContent).toBe("bold");
  });

  it("keeps line breaks of an old plain-text question", () => {
    const { container } = renderSection("line one\nline two");
    const paragraph = container.querySelector("p");
    expect(paragraph?.textContent).toBe("line one\nline two");
    expect(paragraph?.className).toContain("whitespace-pre-wrap");
  });

  it("does not crash on an unclosed code fence and shows the rest as code", () => {
    const { container } = renderSection("before\n```\nnever closed");
    expect(container.querySelector("pre code")?.textContent).toBe("never closed");
  });

  it("shows tags as a labelled list and hides the block when there are none", () => {
    renderSection("q", { tags: ["react", "nextjs"] });
    const list = screen.getByRole("list", { name: "Issue tags" });
    expect(list.textContent).toBe("#react#nextjs");
  });

  it("renders no tag list when the case has no tags", () => {
    renderSection("q");
    expect(screen.queryByRole("list", { name: "Issue tags" })).toBeNull();
  });
});

describe("IssueProblemSection attack input", () => {
  it("shows a script tag as text, never as an element", () => {
    const { container } = renderSection("<script>alert(1)</script><img src=x onerror=alert(1)>");
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });

  it("does not turn a javascript: link into an anchor", () => {
    const { container } = renderSection("[click](javascript:alert(1)) and [data](data:text/html,hi)");
    expect(container.querySelector("a")).toBeNull();
  });

  it("only links http(s) targets and opens them safely", () => {
    const { container } = renderSection("[docs](https://example.com/a)");
    const anchor = container.querySelector("a");
    expect(anchor?.getAttribute("href")).toBe("https://example.com/a");
    expect(anchor?.getAttribute("rel")).toBe("noopener noreferrer");
  });
});

describe("RichText truncation marker", () => {
  it("marks text cut at the line limit", () => {
    const { container } = render(<RichText text={Array.from({ length: 2_001 }, (_, i) => `l${i}`).join("\n\n")} />);
    expect(container.querySelector("[data-rich-text-truncated]")).not.toBeNull();
  });

  it("adds no marker for normal text", () => {
    const { container } = render(<RichText text={"short\n\ntext"} />);
    expect(container.querySelector("[data-rich-text-truncated]")).toBeNull();
  });
});
