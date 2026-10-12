import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/actions/issues", () => ({
  publishIssueAction: vi.fn(),
  unpublishIssueAction: vi.fn(),
}));

import { PublishIssueForm } from "@/components/issues/publish-issue-form";

describe("PublishIssueForm", () => {
  it("does not serialize publication confirmation while unchecked", () => {
    const { container } = render(
      <PublishIssueForm
        issueId="issue-1"
        reviewedAt="2026-10-12T12:00:00.000Z"
        isPublished={false}
        csrfToken="csrf-token"
      />,
    );
    const form = container.querySelector("form");
    expect(form).not.toBeNull();

    const unchecked = new FormData(form!);
    expect(unchecked.get("reviewConfirmed")).toBeNull();
    expect(unchecked.get("csrfToken")).toBe("csrf-token");
    expect(unchecked.get("reviewedAt")).toBe("2026-10-12T12:00:00.000Z");

    fireEvent.click(screen.getByRole("checkbox", { name: /reviewed this issue/i }));
    expect(new FormData(form!).get("reviewConfirmed")).toBe("true");
  });

  it("serializes CSRF and revision fields for unpublish", () => {
    const { container } = render(
      <PublishIssueForm
        issueId="issue-1"
        reviewedAt="2026-10-12T12:00:00.000Z"
        isPublished
        csrfToken="csrf-token"
      />,
    );
    const data = new FormData(container.querySelector("form")!);
    expect(data.get("csrfToken")).toBe("csrf-token");
    expect(data.get("expectedUpdatedAt")).toBe("2026-10-12T12:00:00.000Z");
  });
});
