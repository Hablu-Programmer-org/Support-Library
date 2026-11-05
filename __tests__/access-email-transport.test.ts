// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { createTransport, sendMail, close } = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
  close: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: (...args: unknown[]) => createTransport(...args),
  },
}));

import {
  closeAccessEmailTransport,
  sendOpenAiConfirmationEmail,
} from "@/lib/services/n8n-email";

describe("access email transport", () => {
  beforeEach(() => {
    closeAccessEmailTransport();
    vi.clearAllMocks();
    createTransport.mockReturnValue({ sendMail, close });
    sendMail.mockResolvedValue({ accepted: ["student@example.com"], rejected: [] });
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_MAIL = "support@example.com";
    process.env.SMTP_PASSWORD = "secret";
  });

  it("reuses one bounded pooled transporter", async () => {
    const input = {
      to: "student@example.com",
      studentName: "Student",
      requestId: "507f1f77bcf86cd799439011",
    };
    await sendOpenAiConfirmationEmail(input);
    await sendOpenAiConfirmationEmail(input);

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({
      pool: true,
      maxConnections: 2,
      maxMessages: 50,
      connectionTimeout: 8_000,
      greetingTimeout: 8_000,
      socketTimeout: 20_000,
      secure: true,
    }));
    expect(sendMail).toHaveBeenCalledTimes(2);
  });
});
