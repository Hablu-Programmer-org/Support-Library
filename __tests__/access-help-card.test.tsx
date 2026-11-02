import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/actions/n8n-requests", () => ({
  createN8nRequestAction: vi.fn(async () => ({})),
  createAccessRequestsForStudentAction: vi.fn(async () => ({})),
}));

import { AccessHelpCard } from "@/components/n8n/access-help-card";
import { AdminCreateAccessRequestForm } from "@/components/n8n/admin-create-access-request-form";

describe("AccessHelpCard", () => {
  it("offers all three access types as checkboxes", () => {
    render(<AccessHelpCard csrfToken="csrf" requests={[]} />);
    expect(screen.getByRole("group", { name: "Choose access requests" })).not.toBeNull();
    expect(screen.getByRole("checkbox", { name: /n8n access/i })).not.toBeNull();
    expect(screen.getByRole("checkbox", { name: /n8n password reset/i })).not.toBeNull();
    expect(screen.getByRole("checkbox", { name: /OpenAI API access/i })).not.toBeNull();
    expect(screen.getByText(/No API key is emailed/i)).not.toBeNull();
  });

  it("disables only the type that already has an active request", () => {
    render(<AccessHelpCard csrfToken="csrf" requests={[{
      id: "request-1",
      requestType: "OPENAI_ACCESS",
      status: "PENDING",
    }]} />);
    expect((screen.getByRole("checkbox", { name: /OpenAI API access/i }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("checkbox", { name: /n8n access/i }) as HTMLInputElement).disabled).toBe(false);
  });
});

describe("AdminCreateAccessRequestForm", () => {
  it("accepts an account email and the same three access types", () => {
    render(<AdminCreateAccessRequestForm csrfToken="csrf" />);
    expect(screen.getByLabelText("Student email")).not.toBeNull();
    expect(screen.getByRole("checkbox", { name: "n8n access" })).not.toBeNull();
    expect(screen.getByRole("checkbox", { name: "n8n password reset" })).not.toBeNull();
    expect(screen.getByRole("checkbox", { name: "OpenAI API access" })).not.toBeNull();
  });
});
