import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IssueDetailsHint } from "@/components/shared/issue-details-hint";
import {
  hasEnoughIssueDetails,
  issueDetailsCharacterCount,
} from "@/lib/issue-content-rules";

describe("issue detail quality hint", () => {
  it("counts normalized text instead of whitespace padding", () => {
    expect(issueDetailsCharacterCount("  Two   words\n\n only  ")).toBe(14);
    expect(hasEnoughIssueDetails("Two words" + " \n ".repeat(30))).toBe(false);
  });

  it("shows the create minimum until enough context is present", () => {
    const { rerender } = render(<IssueDetailsHint value="Too short" />);

    expect(screen.getByText("Add at least 40 characters.")).not.toBeNull();
    expect(screen.getByText("9/20,000")).not.toBeNull();

    rerender(
      <IssueDetailsHint value="The assignment page returns a 404 after I press the submit button." />,
    );

    expect(screen.getByText("Enough detail for the support team.")).not.toBeNull();
  });

  it("does not impose the create minimum in legacy edit mode", () => {
    render(<IssueDetailsHint value="Short" requireCreateMinimum={false} />);

    expect(screen.getByText("Describe the issue clearly for the support team.")).not.toBeNull();
    expect(screen.queryByText(/Add at least/)).toBeNull();
  });
});
