import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LinkList } from "@/components/shared/link-list";

describe("LinkList", () => {
  it("renders bold in the title and a clickable link in the summary", () => {
    const { container } = render(
      <LinkList
        videoLinks={[
          {
            title: "**Setup** walkthrough",
            url: "https://youtu.be/abc123",
            timestamp: "01:30",
            summary: "See [the docs](https://example.com/docs)",
          },
        ]}
      />,
    );

    const title = container.querySelector("a");
    expect(title?.textContent).toBe("Setup walkthrough");
    expect(title?.querySelector("strong")?.textContent).toBe("Setup");
    expect(title?.getAttribute("href")).toBe("https://youtu.be/abc123");

    const summaryLink = screen.getByRole("link", { name: "the docs" });
    expect(summaryLink.getAttribute("href")).toBe("https://example.com/docs");
  });

  it("keeps link syntax literal in the title, which is already an anchor", () => {
    const { container } = render(
      <LinkList
        videoLinks={[
          {
            title: "[nested](https://example.com)",
            url: "https://youtu.be/abc123",
          },
        ]}
      />,
    );

    expect(container.querySelectorAll("a")).toHaveLength(1);
    expect(container.querySelector("a")?.textContent).toBe("[nested](https://example.com)");
  });
});
