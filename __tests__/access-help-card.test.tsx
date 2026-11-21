import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/actions/n8n-requests", () => ({
  createN8nRequestAction: vi.fn(async () => ({})),
  createAccessRequestsForStudentAction: vi.fn(async () => ({})),
  confirmOpenAiAccessAction: vi.fn(async () => ({})),
  sendN8nLinkAction: vi.fn(async () => ({})),
}));
vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));

import {
  AccessHelpCard,
  accessCardStartsOpen,
  newestByType,
  requestStatusMessage,
  sentRequestsMessage,
  toolSummary,
} from "@/components/tool-access/access-help-card";
import { AdminCreateAccessRequestForm } from "@/components/tool-access/admin-create-access-request-form";
import { CopyEmailButton } from "@/components/tool-access/copy-email-button";
import { OpenAiConfirmForm } from "@/components/tool-access/openai-confirm-form";
import { createAccessRequestsForStudentAction } from "@/actions/n8n-requests";

describe("sentRequestsMessage", () => {
  it("returns null until an email has been sent", () => {
    expect(sentRequestsMessage([])).toBeNull();
    expect(sentRequestsMessage([{ id: "1", requestType: "ACCESS", status: "PENDING" }])).toBeNull();
    expect(sentRequestsMessage([{ id: "1", requestType: "ACCESS", status: "FAILED" }])).toBeNull();
  });

  it("names a single sent request", () => {
    expect(sentRequestsMessage([{ id: "1", requestType: "ACCESS", status: "SENT" }]))
      .toBe("n8n invite sent — check Inbox/Spam.");
    expect(sentRequestsMessage([{ id: "1", requestType: "PASSWORD_RESET", status: "SENT" }]))
      .toBe("Reset link sent — check Inbox/Spam.");
    expect(sentRequestsMessage([{ id: "1", requestType: "OPENAI_ACCESS", status: "SENT" }]))
      .toBe("OpenAI invite sent — check Inbox/Spam.");
  });

  it("combines any two sent requests", () => {
    expect(sentRequestsMessage([
      { id: "1", requestType: "ACCESS", status: "SENT" },
      { id: "2", requestType: "PASSWORD_RESET", status: "SENT" },
    ])).toBe("n8n invite & Reset link sent — check Inbox/Spam.");
    expect(sentRequestsMessage([
      { id: "1", requestType: "ACCESS", status: "SENT" },
      { id: "2", requestType: "OPENAI_ACCESS", status: "SENT" },
    ])).toBe("n8n & OpenAI invites sent — check Inbox/Spam.");
    expect(sentRequestsMessage([
      { id: "1", requestType: "PASSWORD_RESET", status: "SENT" },
      { id: "2", requestType: "OPENAI_ACCESS", status: "SENT" },
    ])).toBe("Reset link & OpenAI invite sent — check Inbox/Spam.");
  });

  it("combines all three sent requests in a fixed order", () => {
    expect(sentRequestsMessage([
      { id: "1", requestType: "OPENAI_ACCESS", status: "SENT" },
      { id: "2", requestType: "ACCESS", status: "SENT" },
      { id: "3", requestType: "PASSWORD_RESET", status: "SENT" },
    ])).toBe("n8n invite, Reset link & OpenAI invite sent — check Inbox/Spam.");
  });

  it("ignores unsent requests when building the sentence", () => {
    expect(sentRequestsMessage([
      { id: "1", requestType: "ACCESS", status: "SENT" },
      { id: "2", requestType: "OPENAI_ACCESS", status: "PENDING" },
    ])).toBe("n8n invite sent — check Inbox/Spam.");
  });
});

describe("requestStatusMessage", () => {
  it("names a single submitted request and the approval step", () => {
    expect(requestStatusMessage([{ id: "1", requestType: "ACCESS", status: "PENDING" }]))
      .toBe("n8n access request submitted — awaiting admin approval.");
    expect(requestStatusMessage([{ id: "1", requestType: "OPENAI_ACCESS", status: "PENDING" }]))
      .toBe("OpenAI API request submitted — awaiting admin approval.");
  });

  it("combines two submitted requests", () => {
    expect(requestStatusMessage([
      { id: "1", requestType: "ACCESS", status: "PENDING" },
      { id: "2", requestType: "OPENAI_ACCESS", status: "PENDING" },
    ])).toBe("n8n access & OpenAI API requests submitted — awaiting admin approval.");
  });

  it("lists all three submitted requests in a fixed order", () => {
    expect(requestStatusMessage([
      { id: "1", requestType: "OPENAI_ACCESS", status: "PENDING" },
      { id: "2", requestType: "PASSWORD_RESET", status: "PENDING" },
      { id: "3", requestType: "ACCESS", status: "PENDING" },
    ])).toBe("n8n access, password reset & OpenAI API requests submitted — awaiting admin approval.");
  });

  it("explains processing and failed requests", () => {
    expect(requestStatusMessage([{ id: "1", requestType: "PASSWORD_RESET", status: "PROCESSING" }]))
      .toBe("password reset is being processed.");
    expect(requestStatusMessage([{ id: "1", requestType: "ACCESS", status: "FAILED" }]))
      .toBe("n8n access could not be completed — please try again.");
  });

  it("keeps sent and pending work in one summary", () => {
    expect(requestStatusMessage([
      { id: "1", requestType: "ACCESS", status: "SENT" },
      { id: "2", requestType: "OPENAI_ACCESS", status: "PENDING" },
    ])).toBe("OpenAI API request submitted — awaiting admin approval. · n8n invite sent — check Inbox/Spam.");
  });

  it("ignores replaced requests", () => {
    expect(requestStatusMessage([{ id: "1", requestType: "ACCESS", status: "SUPERSEDED" }])).toBeNull();
  });
});

describe("AccessHelpCard", () => {
  it("offers all three access types as checkboxes", () => {
    render(<AccessHelpCard csrfToken="csrf" requests={[]} />);
    expect(screen.getByRole("group", { name: "Choose access requests" })).not.toBeNull();
    expect(screen.getByRole("checkbox", { name: /n8n access/i })).not.toBeNull();
    expect(screen.getByRole("checkbox", { name: /n8n password reset/i })).not.toBeNull();
    expect(screen.getByRole("checkbox", { name: /OpenAI API access/i })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Request access" })).not.toBeNull();
    // "request" on a button belongs to the student's issues, never to tool access.
    expect(screen.queryByRole("button", { name: /submit request/i })).toBeNull();
  });

  it("shows each duration on its own tile and no invitation-only warning", () => {
    render(<AccessHelpCard csrfToken="csrf" requests={[]} />);
    expect(screen.getByText("Valid for 1 year")).toBeTruthy();
    expect(screen.getByText("Valid for 2 months")).toBeTruthy();
    expect(screen.queryByText("n8n: 1 year · OpenAI: 2 months")).toBeNull();
    expect(screen.getByText("Select the access you need.")).toBeTruthy();
    expect(screen.queryByText(/No API key is emailed/i)).toBeNull();
  });

  it("is a region named Tool access", () => {
    render(<AccessHelpCard csrfToken="csrf" requests={[]} />);
    expect(screen.getByRole("region", { name: "Tool access" })).toBeTruthy();
    expect(screen.queryByText("Help & access")).toBeNull();
  });

  it("starts open for a first-time student", () => {
    render(<AccessHelpCard csrfToken="csrf" requests={[]} />);
    expect(screen.getByRole("button", { name: /Close/ }).getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById("access-help-body")!.hasAttribute("inert")).toBe(false);
  });

  it("starts closed with a one-line status once access is in place, and opens on Manage", () => {
    render(<AccessHelpCard
      csrfToken="csrf"
      requests={[{ id: "r1", requestType: "OPENAI_ACCESS", status: "SENT", sentAt: "2026-11-03T10:00:00.000Z" }]}
      entitlements={{ n8n: { state: "ACTIVE", expiresAt: "2027-11-07T05:04:52.000Z" }, openai: null }}
    />);
    const body = document.getElementById("access-help-body")!;
    expect(body.hasAttribute("inert")).toBe(true);
    expect(body.dataset.state).toBe("closed");
    expect(screen.getByTestId("access-summary-n8n").textContent).toBe("n8n: Until 7 Nov 2027");
    expect(screen.getByTestId("access-summary-openai").textContent).toBe("OpenAI: Sent 3 Nov");

    const manage = screen.getByRole("button", { name: /Manage/ });
    expect(manage.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(manage);
    expect(screen.getByRole("button", { name: /Close/ }).getAttribute("aria-expanded")).toBe("true");
    expect(body.hasAttribute("inert")).toBe(false);
    expect(body.dataset.state).toBe("open");
  });

  it("uses no brand gradient", () => {
    const { container } = render(<AccessHelpCard csrfToken="csrf" requests={[]} />);
    expect(container.innerHTML).not.toMatch(/bg-linear-|to-indigo|to-violet/);
  });

  it("disables only the type that already has an active request", () => {
    render(<AccessHelpCard csrfToken="csrf" requests={[{
      id: "request-1",
      requestType: "OPENAI_ACCESS",
      status: "PENDING",
    }]} />);
    expect((screen.getByRole("checkbox", { name: /OpenAI API access/i }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("checkbox", { name: /n8n access/i }) as HTMLInputElement).disabled).toBe(false);
    expect(screen.getByText("Request received")).toBeTruthy();
    expect(screen.getByText("OpenAI API request submitted — awaiting admin approval.")).toBeTruthy();
  });

  it("disables new n8n access while it is still active", () => {
    render(<AccessHelpCard
      csrfToken="csrf"
      requests={[]}
      entitlements={{ n8n: { state: "ACTIVE", expiresAt: "2027-11-07T05:04:52.000Z" }, openai: null }}
    />);
    const access = screen.getByRole("checkbox", { name: /n8n access/i }) as HTMLInputElement;
    expect(access.disabled).toBe(true);
    // A reset needs exactly this active entitlement, so it stays open.
    expect((screen.getByRole("checkbox", { name: /n8n password reset/i }) as HTMLInputElement).disabled).toBe(false);
    expect(screen.getByText("Until 7 Nov 2027")).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: /OpenAI API access/i })).not.toBeNull();
  });

  it("requires an active entitlement before offering a password reset", () => {
    render(<AccessHelpCard csrfToken="csrf" requests={[]} entitlements={{ n8n: null, openai: null }} />);
    expect((screen.getByRole("checkbox", { name: /n8n password reset/i }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("checkbox", { name: /n8n access/i }) as HTMLInputElement).disabled).toBe(false);
    expect(screen.getByText("Needs n8n access")).toBeTruthy();
  });

  it("blocks new access after expiry instead of pretending a request exists", () => {
    render(<AccessHelpCard
      csrfToken="csrf"
      requests={[]}
      entitlements={{ n8n: { state: "EXPIRED", expiresAt: "2026-10-01T05:00:00.000Z" }, openai: null }}
    />);
    expect((screen.getByRole("checkbox", { name: /n8n access/i }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("checkbox", { name: /n8n password reset/i }) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText("Expired 1 Oct 2026")).toBeTruthy();
  });

  it("disables OpenAI only while its own entitlement is active", () => {
    render(<AccessHelpCard
      csrfToken="csrf"
      requests={[]}
      entitlements={{ n8n: null, openai: { state: "ACTIVE", expiresAt: "2027-01-03T05:00:00.000Z" } }}
    />);
    expect((screen.getByRole("checkbox", { name: /OpenAI API access/i }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("checkbox", { name: /n8n access/i }) as HTMLInputElement).disabled).toBe(false);
    expect(screen.getByText("Until 3 Jan 2027")).toBeTruthy();
  });

  it("explains mixed sent and pending requests", () => {
    render(<AccessHelpCard csrfToken="csrf" requests={[
      { id: "request-1", requestType: "ACCESS", status: "SENT" },
      { id: "request-2", requestType: "OPENAI_ACCESS", status: "PENDING" },
    ]} />);
    expect(screen.getByText(
      "OpenAI API request submitted — awaiting admin approval. · n8n invite sent — check Inbox/Spam.",
    )).toBeTruthy();
  });

  it("keeps a pending message calm even if an older attempt failed", () => {
    render(<AccessHelpCard csrfToken="csrf" requests={[
      { id: "new", requestType: "ACCESS", status: "PENDING" },
      { id: "old", requestType: "ACCESS", status: "FAILED" },
    ]} />);
    const message = screen.getByText("n8n access request submitted — awaiting admin approval.");
    expect(message.className).not.toContain("text-red-600");
  });

  it("shows a sent chip with the date and a typed inbox message", () => {
    render(<AccessHelpCard csrfToken="csrf" requests={[{
      id: "request-1",
      requestType: "ACCESS",
      status: "SENT",
      sentAt: "2026-11-03T10:00:00.000Z",
    }]} />);
    expect(screen.getByText(/^Sent/)).toBeTruthy();
    // Fixed en-GB + Dhaka: never "Nov 3" (server locale) or a neighbouring day.
    expect(screen.getByText("Sent · 3 Nov")).toBeTruthy();
    expect(screen.getByText("n8n invite sent — check Inbox/Spam.")).toBeTruthy();
  });

  it("summarises several sent requests in one line", () => {
    render(<AccessHelpCard csrfToken="csrf" requests={[
      { id: "request-1", requestType: "ACCESS", status: "SENT" },
      { id: "request-2", requestType: "PASSWORD_RESET", status: "SENT" },
      { id: "request-3", requestType: "OPENAI_ACCESS", status: "SENT" },
    ]} />);
    expect(screen.getByText("n8n invite, Reset link & OpenAI invite sent — check Inbox/Spam.")).toBeTruthy();
  });

  it("labels failed and replaced requests clearly", () => {
    render(<AccessHelpCard csrfToken="csrf" requests={[
      { id: "request-1", requestType: "PASSWORD_RESET", status: "FAILED" },
      { id: "request-2", requestType: "ACCESS", status: "SUPERSEDED" },
    ]} />);
    expect(screen.getByText("Try again")).toBeTruthy();
    expect(screen.getByText("Replaced")).toBeTruthy();
  });
});

describe("toolSummary", () => {
  const latest = (requests: Parameters<typeof newestByType>[0]) => newestByType(requests);

  it("prefers an active entitlement", () => {
    expect(toolSummary("n8n", latest([{ id: "1", requestType: "ACCESS", status: "FAILED" }]), {
      n8n: { state: "ACTIVE", expiresAt: "2027-11-07T05:04:52.000Z" },
    })).toEqual({ label: "Until 7 Nov 2027", tone: "success" });
  });

  it("reads the newest request for the tool", () => {
    expect(toolSummary("openai", latest([{ id: "1", requestType: "OPENAI_ACCESS", status: "PENDING" }])))
      .toEqual({ label: "Request received", tone: "pending" });
    expect(toolSummary("openai", latest([{ id: "1", requestType: "OPENAI_ACCESS", status: "PROCESSING" }])))
      .toEqual({ label: "Processing", tone: "pending" });
    expect(toolSummary("n8n", latest([{ id: "1", requestType: "ACCESS", status: "FAILED" }])))
      .toEqual({ label: "Try again", tone: "error" });
    expect(toolSummary("n8n", latest([{ id: "1", requestType: "ACCESS", status: "REJECTED" }])))
      .toEqual({ label: "Not approved", tone: "error" });
    expect(toolSummary("n8n", latest([{ id: "1", requestType: "ACCESS", status: "SENT", sentAt: "2026-11-03T10:00:00.000Z" }])))
      .toEqual({ label: "Sent 3 Nov", tone: "success" });
  });

  it("ignores a password reset and a replaced request for the n8n state", () => {
    expect(toolSummary("n8n", latest([{ id: "1", requestType: "PASSWORD_RESET", status: "SENT" }])))
      .toEqual({ label: "Not requested", tone: "muted" });
    expect(toolSummary("n8n", latest([{ id: "1", requestType: "ACCESS", status: "SUPERSEDED" }])))
      .toEqual({ label: "Not requested", tone: "muted" });
  });

  it("falls back to an expired or revoked entitlement", () => {
    expect(toolSummary("n8n", latest([]), { n8n: { state: "EXPIRED", expiresAt: "2026-10-01T05:00:00.000Z" } }))
      .toEqual({ label: "Expired 1 Oct 2026", tone: "muted" });
    expect(toolSummary("openai", latest([]), {
      openai: { state: "REVOKED", expiresAt: "2027-01-01T00:00:00.000Z", revokedAt: "2026-09-02T05:00:00.000Z" },
    })).toEqual({ label: "Revoked 2 Sept 2026", tone: "muted" });
  });
});

describe("accessCardStartsOpen", () => {
  it("opens for a first-time student", () => {
    expect(accessCardStartsOpen([])).toBe(true);
    expect(accessCardStartsOpen([], { n8n: null, openai: null })).toBe(true);
  });

  it("opens when the newest request failed or was not approved", () => {
    expect(accessCardStartsOpen([{ id: "1", requestType: "OPENAI_ACCESS", status: "FAILED" }])).toBe(true);
    expect(accessCardStartsOpen([{ id: "1", requestType: "ACCESS", status: "REJECTED" }])).toBe(true);
  });

  it("stays closed once something is pending, sent or active", () => {
    expect(accessCardStartsOpen([{ id: "1", requestType: "ACCESS", status: "PENDING" }])).toBe(false);
    expect(accessCardStartsOpen([{ id: "1", requestType: "ACCESS", status: "SENT" }])).toBe(false);
    expect(accessCardStartsOpen([], { n8n: { state: "ACTIVE", expiresAt: "2027-01-01T00:00:00.000Z" } })).toBe(false);
  });

  it("ignores an older failure replaced by a newer request", () => {
    expect(accessCardStartsOpen([
      { id: "new", requestType: "ACCESS", status: "PENDING" },
      { id: "old", requestType: "ACCESS", status: "FAILED" },
    ])).toBe(false);
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
    expect(screen.getByText("student@example.com")).toBeTruthy();
    expect(screen.queryByText("Copy email")).toBeNull();
    expect(screen.getByRole("button", { name: "Email copied" }).className).not.toContain("border-slate");
  });

  it("announces a copy failure when clipboard methods are unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn(() => false),
    });

    render(<CopyEmailButton email="student@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: /copy student@example.com/i }));

    await waitFor(() => expect(screen.getByText("Copy failed")).toBeTruthy());
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

  it("shows a partial-success warning instead of hiding the skipped type", async () => {
    vi.mocked(createAccessRequestsForStudentAction).mockResolvedValueOnce({
      success: "1 request created for student@example.com.",
      warning: "Skipped n8n access (n8n access is active until 7 Nov 2027).",
    });
    const { container } = render(<AdminCreateAccessRequestForm csrfToken="csrf" />);
    fireEvent.change(screen.getByLabelText("Student email"), {
      target: { value: "student@example.com" },
    });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(screen.getByText(/Skipped n8n access/)).toBeTruthy());
    expect(screen.getByText("1 request created for student@example.com.")).toBeTruthy();
  });

  it("offers Google step-up instead of forcing a sign-out", () => {
    render(<OpenAiConfirmForm csrfToken="csrf" requestId="request-1" requiresReauth />);
    expect(screen.getByRole("button", { name: "Verify with Google" })).not.toBeNull();
    expect(screen.queryByText(/sign out/i)).toBeNull();
  });
});
