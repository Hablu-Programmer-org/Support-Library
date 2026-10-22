import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/actions/issues", () => ({
  changeIssueStatusActionSimple: vi.fn(),
}));

import { IssueStatusForm } from "@/components/issues/issue-status-form";

const options = [
  { value: "OPEN" as const, label: "Open" },
  { value: "SOLVED" as const, label: "Solved" },
];

describe("IssueStatusForm", () => {
  it("shows the short PII confirmation before solving publishes", () => {
    render(
      <IssueStatusForm
        autoPublish
        csrfToken="csrf-token"
        expectedUpdatedAt="2026-10-22T12:00:00.000Z"
        issueId="issue-1"
        isPublished={false}
        options={options}
        status="OPEN"
      />,
    );

    expect(screen.queryByRole("checkbox")).toBeNull();

    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "SOLVED" } });

    const checkbox = screen.getByRole("checkbox", {
      name: /no student personal information in this issue/i,
    }) as HTMLInputElement;
    expect(checkbox.required).toBe(true);
    expect(checkbox.checked).toBe(false);
    expect(screen.getByRole("button", { name: /save and publish/i })).not.toBeNull();
  });

  it("does not ask for confirmation when the issue is already published", () => {
    render(
      <IssueStatusForm
        autoPublish
        csrfToken="csrf-token"
        expectedUpdatedAt="2026-10-22T12:00:00.000Z"
        issueId="issue-1"
        isPublished
        options={options}
        status="OPEN"
      />,
    );

    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /save and publish/i })).toBeNull();
  });
});
