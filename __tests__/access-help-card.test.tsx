import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/actions/n8n-requests", () => ({
  createN8nRequestAction: vi.fn(async () => ({})),
  createAccessRequestsForStudentAction: vi.fn(async () => ({})),
  confirmOpenAiAccessAction: vi.fn(async () => ({})),
  sendN8nLinkAction: vi.fn(async () => ({})),
}));
vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));

import { AccessHelpCard } from "@/components/tool-access/access-help-card";
import { AdminCreateAccessRequestForm } from "@/components/tool-access/admin-create-access-request-form";
import { CopyEmailButton } from "@/components/tool-access/copy-email-button";
import { OpenAiConfirmForm } from "@/components/tool-access/openai-confirm-form";

describe("AccessHelpCard", () => {
  it("offers all three access types as checkboxes", () => {
    render(<AccessHelpCard csrfToken="csrf" requests={[]} />);
    expect(screen.getByRole("group", { name: "Choose access requests" })).not.toBeNull();
    expect(screen.getByRole("checkbox", { name: /n8n access/i })).not.toBeNull();
    expect(screen.getByRole("checkbox", { name: /n8n password reset/i })).not.toBeNull();
    expect(screen.getByRole("checkbox", { name: /OpenAI API access/i })).not.toBeNull();
  });

  it("disables only the type that already has an active request", () => {
    render(<AccessHelpCard csrfToken="csrf" requests={[{
      id: "request-1",
      requestType: "OPENAI_ACCESS",
      status: "PENDING",
    }]} />);
    expect((screen.getByRole("checkbox", { name: /OpenAI API access/i }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("checkbox", { name: /n8n access/i }) as HTMLInputElement).disabled).toBe(false);
    expect(screen.getByText("Waiting")).toBeTruthy();
  });

  it("shows a sent chip with the date and inbox guidance", () => {
    render(<AccessHelpCard csrfToken="csrf" requests={[{
      id: "request-1",
      requestType: "ACCESS",
      status: "SENT",
      sentAt: "2026-11-03T10:00:00.000Z",
    }]} />);
    expect(screen.getByText(/^Sent/)).toBeTruthy();
    expect(screen.getByText(/Check Inbox and Spam/i)).toBeTruthy();
  });

  it("shows a failed chip", () => {
    render(<AccessHelpCard csrfToken="csrf" requests={[{
      id: "request-1",
      requestType: "PASSWORD_RESET",
      status: "FAILED",
    }]} />);
    expect(screen.getByText("Failed")).toBeTruthy();
  });
});

describe("CopyEmailButton", () => {
  it("copies the student email to the clipboard and confirms it", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<CopyEmailButton email="student@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: /copy student@example.com/i }));

    expect(writeText).toHaveBeenCalledWith("student@example.com");
    await waitFor(() => expect(screen.getByText("Copied")).toBeTruthy());
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

  it("offers Google step-up instead of forcing a sign-out", () => {
    render(<OpenAiConfirmForm csrfToken="csrf" requestId="request-1" requiresReauth />);
    expect(screen.getByRole("button", { name: "Verify with Google" })).not.toBeNull();
    expect(screen.queryByText(/sign out/i)).toBeNull();
  });
});
