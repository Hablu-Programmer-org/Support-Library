import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/actions/replies", () => ({
  addReplyAction: vi.fn(async () => ({
    fieldErrors: { _form: ["Unable to save the response. Please try again."] },
  })),
}));

import { ReplyComposer } from "@/components/issues/reply-composer";

describe("ReplyComposer", () => {
  it("carries CSRF and an operation id for the server action", () => {
    const { container } = render(<ReplyComposer issueId="issue-1" csrfToken="csrf-token" />);

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    const data = new FormData(form!);
    expect(data.get("csrfToken")).toBe("csrf-token");
    expect(form!.querySelector('input[name="operationId"]')).not.toBeNull();
  });

  it("renders a failed save as an inline alert instead of throwing", async () => {
    const { container } = render(<ReplyComposer issueId="issue-1" csrfToken="csrf-token" />);

    fireEvent.submit(container.querySelector("form")!);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Unable to save the response. Please try again.");
  });
});
