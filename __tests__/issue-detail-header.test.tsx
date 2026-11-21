import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IssueDetailHeader } from "@/components/issues/issue-detail-header";

type Props = Parameters<typeof IssueDetailHeader>[0];

const base: Props = {
  title: "Supabase 403 on insert",
  status: "OPEN",
  priority: "HIGH",
  isPublished: true,
  createdAt: new Date("2026-11-21T05:58:00Z"),
  updatedAt: new Date("2026-11-21T06:03:00Z"),
  backHref: "/dashboard/issues",
  backLabel: "Back to Issues",
  canEdit: false,
};

const admin: Partial<Props> = {
  canEdit: true,
  caseRef: "HSL-1042",
  editHref: "/dashboard/issues/abc/edit",
  aiPrompt: "prompt text",
};

const renderHeader = (extra: Partial<Props> = {}) =>
  render(<IssueDetailHeader {...base} {...extra} />);

describe("IssueDetailHeader roles", () => {
  it("admin sees the reference, Copy for AI and Edit", () => {
    renderHeader(admin);
    expect(screen.getByText("HSL-1042")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy reference" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy for AI" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Edit issue details" }).getAttribute("href")).toBe(
      "/dashboard/issues/abc/edit",
    );
  });

  it("mentor (no prompt) sees Edit but not Copy for AI", () => {
    renderHeader({ ...admin, aiPrompt: null });
    expect(screen.queryByRole("button", { name: "Copy for AI" })).toBeNull();
    expect(screen.getByRole("link", { name: "Edit issue details" })).toBeTruthy();
  });

  it("public viewer sees no reference and no action", () => {
    renderHeader();
    expect(screen.queryByText("HSL-1042")).toBeNull();
    expect(screen.queryByRole("button", { name: "Copy for AI" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Edit issue details" })).toBeNull();
  });

  it("ignores staff-only props when the viewer is not staff", () => {
    // Defence in depth: even if the page passed them by mistake.
    renderHeader({ ...admin, canEdit: false });
    expect(screen.queryByText("HSL-1042")).toBeNull();
    expect(screen.queryByRole("button", { name: "Copy for AI" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Edit issue details" })).toBeNull();
  });
});

describe("IssueDetailHeader content", () => {
  it("shows the title as the only h1 and the chips", () => {
    renderHeader();
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual([
      "Supabase 403 on insert",
    ]);
    expect(screen.getByText("Open")).toBeTruthy();
    expect(screen.getByText("High priority")).toBeTruthy();
    expect(screen.getByText("Student Library")).toBeTruthy();
  });

  it("falls back to Normal priority and hides the library chip when unpublished", () => {
    renderHeader({ priority: null, isPublished: false });
    expect(screen.getByText("Normal priority")).toBeTruthy();
    expect(screen.queryByText("Student Library")).toBeNull();
  });

  it("renders created and updated as machine-readable times", () => {
    const { container } = renderHeader();
    const times = Array.from(container.querySelectorAll("time")).map((t) => t.getAttribute("datetime"));
    expect(times).toEqual(["2026-11-21T05:58:00.000Z", "2026-11-21T06:03:00.000Z"]);
  });

  it("leaves no empty reference chip when staff view has no caseRef", () => {
    renderHeader({ ...admin, caseRef: null });
    expect(screen.queryByRole("button", { name: "Copy reference" })).toBeNull();
  });

  it("lets a long unbroken title wrap instead of overflowing", () => {
    renderHeader({ title: "x".repeat(200) });
    expect(screen.getByRole("heading", { level: 1 }).className).toContain("wrap-break-word");
  });

  it("keeps the back link and its label", () => {
    renderHeader({ backHref: "/dashboard/issues?page=2", backLabel: "Back to results" });
    expect(screen.getByRole("link", { name: "Back to results" }).getAttribute("href")).toBe(
      "/dashboard/issues?page=2",
    );
  });
});
