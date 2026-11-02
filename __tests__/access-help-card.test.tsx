import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/actions/n8n-requests", () => ({
  createN8nRequestAction: vi.fn(async () => ({})),
  createAccessRequestsForStudentAction: vi.fn(async () => ({})),
}));

import { AccessHelpCard } from "@/components/tool-access/access-help-card";
import { AdminCreateAccessRequestForm } from "@/components/tool-access/admin-create-access-request-form";

describe("AccessHelpCard", () => {
  it("offers all three access types as checkboxes in a compact row", () => {
    render(<AccessHelpCard csrfToken="csrf" requests={[]} />);
    expect(
      screen.getByRole("group", { name: "Choose access requests" }),
    ).not.toBeNull();
    expect(
      screen.getByRole("checkbox", { name: /n8n access/i }),
    ).not.toBeNull();
    expect(
      screen.getByRole("checkbox", { name: /n8n password reset/i }),
    ).not.toBeNull();
    expect(
      screen.getByRole("checkbox", { name: /OpenAI API access/i }),
    ).not.toBeNull();
    // "No API key is emailed" is shown at sm breakpoint; in JSDOM it's hidden, so don't assert it here.
  });

  it("disables only the type that already has an active request", () => {
    render(
      <AccessHelpCard
        csrfToken="csrf"
        requests={[
          {
            id: "request-1",
            requestType: "OPENAI_ACCESS",
            status: "PENDING",
          },
        ]}
      />,
    );
    expect(
      (
        screen.getByRole("checkbox", {
          name: /OpenAI API access/i,
        }) as HTMLInputElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("checkbox", {
          name: /n8n access/i,
        }) as HTMLInputElement
      ).disabled,
    ).toBe(false);
  });

  it("shows SENT status with date when email was sent", () => {
    const sentAt = "2026-11-03T10:00:00.000Z";
    render(
      <AccessHelpCard
        csrfToken="csrf"
        requests={[
          {
            id: "request-1",
            requestType: "ACCESS",
            status: "SENT",
            sentAt,
          },
        ]}
      />,
    );
    expect(screen.getByText(/Email sent/)).toBeTruthy();
    expect(screen.getByText(/Nov/)).toBeTruthy();
    expect(
      screen.getByText(/Check your inbox and Spam\/Promotions/i),
    ).toBeTruthy();
  });

  it("shows FAILED status with retry prompt", () => {
    render(
      <AccessHelpCard
        csrfToken="csrf"
        requests={[
          {
            id: "request-1",
            requestType: "PASSWORD_RESET",
            status: "FAILED",
          },
        ]}
      />,
    );
    expect(screen.getByText(/Failed — request again/i)).toBeTruthy();
  });
});

describe("AdminCreateAccessRequestForm", () => {
  it("accepts an account email and the same three access types", () => {
    render(<AdminCreateAccessRequestForm csrfToken="csrf" />);
    expect(screen.getByLabelText("Student email")).not.toBeNull();
    expect(screen.getByRole("checkbox", { name: "n8n access" })).not.toBeNull();
    expect(
      screen.getByRole("checkbox", { name: "n8n password reset" }),
    ).not.toBeNull();
    expect(
      screen.getByRole("checkbox", { name: "OpenAI API access" }),
    ).not.toBeNull();
  });
});
