import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/actions/n8n-requests", () => ({
  createN8nRequestAction: vi.fn(async () => ({})),
}));

import { AccessHelpCard } from "@/components/n8n/access-help-card";

describe("AccessHelpCard", () => {
  it("switches between n8n and OpenAI request forms", () => {
    render(<AccessHelpCard csrfToken="csrf" requests={[]} />);
    expect(screen.getByRole("group", { name: "Choose n8n help" })).not.toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "OpenAI API access" }));
    expect(screen.getByLabelText("What do you want to build?")).not.toBeNull();
    expect(screen.getByText(/API keys are never sent by email/i)).not.toBeNull();
  });

  it("shows an active OpenAI request instead of another form", () => {
    render(<AccessHelpCard csrfToken="csrf" requests={[{
      id: "request-1",
      requestType: "OPENAI_ACCESS",
      status: "PENDING",
    }]} />);
    fireEvent.click(screen.getByRole("tab", { name: /OpenAI API access/ }));
    expect(screen.getByText("Your request is with the support team")).not.toBeNull();
    expect(screen.queryByLabelText("What do you want to build?")).toBeNull();
  });
});
