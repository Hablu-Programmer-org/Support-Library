import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IssuesHero, ISSUES_HERO_MAX_TAGS } from "@/components/issues/issues-hero";

const tag = (name: string, active = false) => ({
  tag: name,
  href: `/dashboard/issues?tag=${encodeURIComponent(name)}`,
  active,
});

describe("IssuesHero", () => {
  it("renders the exact h1 text the e2e suite asserts", () => {
    render(<IssuesHero title="Student Support Library" tags={[]} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Student Support Library");
  });

  it("has no search input of its own (the filter form owns q)", () => {
    const { container } = render(<IssuesHero title="T" tags={[tag("n8n")]} />);
    expect(container.querySelector('input[name="q"]')).toBeNull();
  });

  it("links each tag chip to its filter URL", () => {
    render(<IssuesHero title="T" tags={[tag("n8n"), tag("open ai")]} />);
    const nav = screen.getByRole("navigation", { name: "Popular tags" });
    expect(within(nav).getByRole("link", { name: "#n8n" }).getAttribute("href")).toBe(
      "/dashboard/issues?tag=n8n",
    );
    expect(within(nav).getByRole("link", { name: "#open ai" }).getAttribute("href")).toBe(
      "/dashboard/issues?tag=open%20ai",
    );
  });

  it("caps the chips", () => {
    const tags = Array.from({ length: 15 }, (_, i) => tag(`t${i}`));
    render(<IssuesHero title="T" tags={tags} />);
    expect(screen.getAllByRole("link")).toHaveLength(ISSUES_HERO_MAX_TAGS);
  });

  it("hides the chip row when there are no tags", () => {
    render(<IssuesHero title="T" tags={[]} />);
    expect(screen.queryByRole("navigation", { name: "Popular tags" })).toBeNull();
  });

  it("marks the active tag", () => {
    render(<IssuesHero title="T" tags={[tag("n8n", true), tag("react")]} />);
    expect(screen.getByRole("link", { name: "#n8n" }).getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("link", { name: "#react" }).getAttribute("aria-current")).toBeNull();
  });

  it("renders a tag with markup as text", () => {
    const { container } = render(<IssuesHero title="T" tags={[tag("<img src=x onerror=alert(1)>")]} />);
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders the actions slot", () => {
    render(<IssuesHero title="T" tags={[]} actions={<button type="button">Create an issue</button>} />);
    expect(screen.getByRole("button", { name: "Create an issue" })).toBeTruthy();
  });
});
