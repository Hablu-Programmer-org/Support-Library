import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/actions/n8n-requests", () => ({
  createN8nRequestAction: vi.fn(async () => ({})),
  createAccessRequestsForStudentAction: vi.fn(async () => ({})),
  confirmOpenAiAccessAction: vi.fn(async () => ({})),
  sendN8nLinkAction: vi.fn(async () => ({})),
  rejectAccessRequestAction: vi.fn(async () => ({})),
}));
vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { AccessRequestRow, type AccessRowRequest } from "@/components/tool-access/access-request-row";

const base: AccessRowRequest = {
  id: "req-1",
  typeLabel: "n8n access",
  statusLabel: "Waiting",
  statusTone: "waiting",
  dateLabel: "3 Nov 2026, 19:08",
  studentName: "Ahmad Musa",
  email: "ahmad@test.com",
  batchLabel: "Batch 4",
  historyLabel: "n8n access sent 2× · Last 1 Nov",
  firstRequestedLabel: "Requested 1 Nov",
  entitlementLabel: "No prior access",
  enrollmentLabel: "Enrollment active",
  createdByEmail: null,
  variant: "n8n",
  canApprove: true,
  canReject: true,
};

describe("AccessRequestRow", () => {
  it("shows the batch and access history on one compact line", () => {
    render(<AccessRequestRow request={base} csrfToken="csrf" requiresReauth={false} />);

    expect(screen.getByRole("heading", { name: "Ahmad Musa" })).toBeTruthy();
    expect(screen.getByText("Batch 4")).toBeTruthy();
    expect(screen.getByText("n8n access sent 2× · Last 1 Nov")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Copy ahmad@test\.com/i })).toBeTruthy();
  });

  it("shows the n8n action directly and gates send on a link", () => {
    render(<AccessRequestRow request={base} csrfToken="csrf" requiresReauth={false} />);

    expect(screen.queryByRole("button", { name: "Process" })).toBeNull();
    const link = screen.getByLabelText("n8n link") as HTMLInputElement;
    const send = screen.getByRole("button", { name: "Send email" }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(link, { target: { value: "https://n8n.hablu-programmer.com/invite" } });
    expect(send.disabled).toBe(false);
  });

  it("makes the full OpenAI confirmation label clickable", () => {
    render(
      <AccessRequestRow
        request={{ ...base, typeLabel: "OpenAI", variant: "openai" }}
        csrfToken="csrf"
        requiresReauth={false}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Added this exact email" }) as HTMLInputElement;
    const confirm = screen.getByRole("button", { name: "Confirm & email student" }) as HTMLButtonElement;
    expect(checkbox.checked).toBe(false);
    expect(confirm.disabled).toBe(true);
    fireEvent.click(screen.getByText("Added this exact email"));
    expect(checkbox.checked).toBe(true);
    expect(confirm.disabled).toBe(false);
  });

  it("blocks processing when the student is not in the agent course", () => {
    render(
      <AccessRequestRow
        request={{ ...base, batchLabel: null, canApprove: false, enrollmentLabel: "No enrollment" }}
        csrfToken="csrf"
        requiresReauth={false}
      />,
    );

    expect(screen.getByText("Not enrolled in the AI Agent course")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Process" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Send email" })).toBeNull();
  });

  it("hides the action for rows that are already sent", () => {
    render(
      <AccessRequestRow
        request={{ ...base, canApprove: false, canReject: false, statusLabel: "Sent", statusTone: "sent" }}
        csrfToken="csrf"
        requiresReauth={false}
      />,
    );

    expect(screen.queryByRole("button", { name: "Send email" })).toBeNull();
  });
});
