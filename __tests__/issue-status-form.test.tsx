import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/actions/issues", () => ({
  changeIssueStatusAction: vi.fn(),
}));

import { IssueStatusForm } from "@/components/issues/issue-status-form";

const options = [
  { value: "OPEN" as const, label: "Open" },
  { value: "SOLVED" as const, label: "Solved" },
];

describe("IssueStatusForm", () => {
  it("saves Solved straight away, with no publish step of its own", () => {
    const submit = vi.spyOn(HTMLFormElement.prototype, "requestSubmit").mockImplementation(() => {});
    render(
      <IssueStatusForm
        csrfToken="csrf-token"
        expectedUpdatedAt="2026-10-22T12:00:00.000Z"
        issueId="issue-1"
        options={options}
        status="OPEN"
      />,
    );

    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "SOLVED" } });

    expect(submit).toHaveBeenCalledTimes(1);
    // Publishing lives only on the separate publish form.
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /publish/i })).toBeNull();
    submit.mockRestore();
  });
});
