import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/actions/n8n-requests", () => ({
  createN8nRequestAction: vi.fn(async () => ({})),
  createAccessRequestsForStudentAction: vi.fn(async () => ({})),
  confirmOpenAiAccessAction: vi.fn(async () => ({})),
  sendN8nLinkAction: vi.fn(async () => ({})),
}));
vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));

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
  createdByEmail: null,
  variant: "n8n",
  actionable: true,
  agentEligible: true,
};

describe("AccessRequestRow", () => {
  it("shows the batch and access history on one compact line", () => {
    render(<AccessRequestRow request={base} csrfToken="csrf" requiresReauth={false} />);

    expect(screen.getByRole("heading", { name: "Ahmad Musa" })).toBeTruthy();
    expect(screen.getByText("Batch 4")).toBeTruthy();
    expect(screen.getByText("n8n access sent 2× · Last 1 Nov")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Copy ahmad@test\.com/i })).toBeTruthy();
  });

  it("keeps the send form collapsed until Process is opened", () => {
    render(<AccessRequestRow request={base} csrfToken="csrf" requiresReauth={false} />);

    const process = screen.getByRole("button", { name: "Process" });
    expect(process.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector('input[name="link"]')).toBeNull();

    fireEvent.click(process);

    expect(document.querySelector('input[name="link"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: "Close" }).getAttribute("aria-expanded")).toBe("true");
  });

  it("blocks processing when the student is not in the agent course", () => {
    render(
      <AccessRequestRow
        request={{ ...base, batchLabel: null, agentEligible: false }}
        csrfToken="csrf"
        requiresReauth={false}
      />,
    );

    expect(screen.getByText("Not enrolled in the AI Agent course")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Process" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("hides the action for rows that are already sent", () => {
    render(
      <AccessRequestRow
        request={{ ...base, actionable: false, statusLabel: "Sent", statusTone: "sent" }}
        csrfToken="csrf"
        requiresReauth={false}
      />,
    );

    expect(screen.queryByRole("button", { name: "Process" })).toBeNull();
  });
});