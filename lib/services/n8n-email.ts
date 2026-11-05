import "server-only";

import nodemailer from "nodemailer";

import type { N8nRequestType } from "@/models";
import type { AccessRejectionReason } from "@/models/n8n-access-request";

const escapeHtml = (value: string) =>
  value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] ?? character);

type AccessEmailTransport = ReturnType<typeof nodemailer.createTransport>;
const globalForEmail = globalThis as unknown as {
  __accessEmailTransport?: AccessEmailTransport;
};

function transporter() {
  if (globalForEmail.__accessEmailTransport) return globalForEmail.__accessEmailTransport;
  const port = Number(process.env.SMTP_PORT ?? "587");
  globalForEmail.__accessEmailTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    service: process.env.SMTP_SERVICE || undefined,
    auth: { user: process.env.SMTP_MAIL, pass: process.env.SMTP_PASSWORD },
    pool: true,
    maxConnections: 2,
    maxMessages: 50,
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 20_000,
  });
  return globalForEmail.__accessEmailTransport;
}

export function closeAccessEmailTransport() {
  globalForEmail.__accessEmailTransport?.close();
  globalForEmail.__accessEmailTransport = undefined;
}

export async function sendN8nHelpEmail(input: {
  to: string;
  studentName: string;
  requestType: N8nRequestType;
  link: string;
  requestId: string;
  messageId?: string;
}) {
  const reset = input.requestType === "PASSWORD_RESET";
  const openAi = input.requestType === "OPENAI_ACCESS";
  const title = openAi ? "Your OpenAI access is ready" : reset ? "Reset your n8n password" : "Your n8n access is ready";
  const action = openAi ? "Accept OpenAI access" : reset ? "Reset n8n password" : "Set up n8n access";
  const name = escapeHtml(input.studentName);
  const link = escapeHtml(input.link);
  const text = openAi
    ? "Use the secure button below to accept your OpenAI workspace invitation. This email never contains an API key."
    : reset
    ? "Use the secure button below to choose a new password."
    : "Use the secure button below to accept your invitation and set up your n8n account.";

  return transporter().sendMail({
    messageId: input.messageId ?? `<access-${input.requestId}@hablu-programmer.com>`,
    from: `Hablu Support Library <${process.env.SMTP_MAIL}>`,
    to: input.to,
    subject: `${title} | Hablu Programmer`,
    text: `Hi ${input.studentName},\n\n${text}\n\n${action}: ${input.link}\n\nThis link may expire, so use it soon. If you did not request this, ignore this email. Never share this link.\n\nHablu Support Library`,
    html: `<div style="background:#f8fafc;padding:32px 16px;font-family:Arial,sans-serif;color:#0f172a"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px"><p style="color:#0891b2;font-weight:700;margin:0 0 12px">HABLU SUPPORT LIBRARY</p><h1 style="font-size:24px;margin:0 0 16px">${title}</h1><p>Hi ${name},</p><p>${text}</p><p style="margin:28px 0"><a href="${link}" style="background:#0891b2;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700">${action}</a></p><p style="font-size:14px;color:#475569">This link may expire, so use it soon. Never share it with anyone.</p><p style="font-size:14px;color:#475569">If you didn't get this email, check Spam or Promotions.</p><p style="font-size:14px;color:#475569">If you did not request this, you can safely ignore this email.</p></div></div>`,
  });
}

/**
 * OpenAI access is added by an admin in the OpenAI dashboard; OpenAI itself
 * sends the workspace invitation. This email is only a confirmation that the
 * student's address was added, so it carries no invitation link and no secret.
 */
export async function sendOpenAiConfirmationEmail(input: {
  to: string;
  studentName: string;
  requestId: string;
  messageId?: string;
}) {
  const name = escapeHtml(input.studentName);
  const email = escapeHtml(input.to);
  const text = `Your email (${input.to}) was added to the Hablu Programmer OpenAI API workspace invitation list. OpenAI sends the invitation separately — check your inbox and Spam/Promotions. Access is complete only after you accept that invitation. Sign in at https://platform.openai.com/ using this address. We never email API keys, so never share a key with anyone.`;

  return transporter().sendMail({
    messageId: input.messageId ?? `<openai-access-${input.requestId}@hablu-programmer.com>`,
    from: `Hablu Support Library <${process.env.SMTP_MAIL}>`,
    to: input.to,
    subject: "Your OpenAI workspace invitation was sent | Hablu Programmer",
    text: `Hi ${input.studentName},\n\n${text}\n\nIf you did not request this, reply to this email so we can review it.\n\nHablu Support Library`,
    html: `<div style="background:#f8fafc;padding:32px 16px;font-family:Arial,sans-serif;color:#0f172a"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px"><p style="color:#0891b2;font-weight:700;margin:0 0 12px">HABLU SUPPORT LIBRARY</p><h1 style="font-size:24px;margin:0 0 16px">Your OpenAI workspace invitation was sent</h1><p>Hi ${name},</p><p>Your email <strong>${email}</strong> was added to the Hablu Programmer OpenAI API workspace invitation list.</p><p>OpenAI sends its invitation separately, so check your inbox and Spam or Promotions. Access is complete only after you accept it.</p><p style="margin:28px 0"><a href="https://platform.openai.com/" style="background:#0891b2;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700">Open platform.openai.com</a></p><p style="font-size:14px;color:#475569">Sign in with this email address. We never email API keys, so never share a key with anyone.</p><p style="font-size:14px;color:#475569">If you did not request this, reply to this email so we can review it.</p></div></div>`,
  });
}

const REJECTION_COPY: Record<AccessRejectionReason, { subject: string; body: string }> = {
  ACCESS_PERIOD_EXPIRED: {
    subject: "নির্ধারিত access period শেষ হয়েছে",
    body: "এই access-এর নির্ধারিত সময়সীমা ইতোমধ্যে শেষ হয়েছে।",
  },
  BATCH_NOT_ELIGIBLE: {
    subject: "বর্তমান batch এই access-এর জন্য eligible নয়",
    body: "আপনার বর্তমান batch এই access-এর eligibility policy-এর মধ্যে নেই।",
  },
  ALREADY_GRANTED: {
    subject: "এই access আগে দেওয়া হয়েছে",
    body: "আমাদের record অনুযায়ী এই tool-এর access আপনাকে আগে দেওয়া হয়েছে।",
  },
  ENROLLMENT_INACTIVE: {
    subject: "AI Agent course enrollment active নয়",
    body: "আপনার AI Agent course enrollment বর্তমানে active না থাকায় request-টি অনুমোদন করা যায়নি।",
  },
  DUPLICATE_REQUEST: {
    subject: "এটি duplicate request",
    body: "একই access-এর আরেকটি request বা completed record থাকায় এই request-টি বন্ধ করা হয়েছে।",
  },
  ACCOUNT_UNAVAILABLE: {
    subject: "Account যাচাই করা যায়নি",
    body: "আপনার Hablu Programmer account বা enrollment নিরাপদভাবে যাচাই করা যায়নি।",
  },
  OTHER: {
    subject: "Request-টি অনুমোদন করা হয়নি",
    body: "Review শেষে এই request-টি বর্তমানে অনুমোদন করা সম্ভব হয়নি।",
  },
};

export async function sendAccessRejectionEmail(input: {
  to: string;
  studentName: string;
  requestType: N8nRequestType;
  reason: AccessRejectionReason;
  batchNo: number | null;
  requestId: string;
  messageId?: string;
}) {
  const copy = REJECTION_COPY[input.reason];
  const tool = input.requestType === "OPENAI_ACCESS"
    ? "OpenAI"
    : input.requestType === "PASSWORD_RESET"
      ? "n8n password reset"
      : "n8n";
  const batch = input.batchNo ? `Batch: ${input.batchNo}` : "Batch: not available";
  const text = `হ্যালো ${input.studentName},\n\nআপনার ${tool} access request review করা হয়েছে।\n\n${copy.body}\n${batch}\n\nতথ্য ভুল মনে হলে Support Library-তে একটি issue submit করুন।\n\nHablu Support Library`;
  const name = escapeHtml(input.studentName);
  const safeTool = escapeHtml(tool);
  const safeBody = escapeHtml(copy.body);
  const safeBatch = escapeHtml(batch);

  return transporter().sendMail({
    messageId: input.messageId ?? `<access-rejected-${input.requestId}@hablu-programmer.com>`,
    from: `Hablu Support Library <${process.env.SMTP_MAIL}>`,
    to: input.to,
    subject: `আপনার ${tool} access request সম্পর্কে | Hablu Programmer`,
    text,
    html: `<div style="background:#f8fafc;padding:32px 16px;font-family:Arial,sans-serif;color:#0f172a"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px"><p style="color:#0891b2;font-weight:700;margin:0 0 12px">HABLU SUPPORT LIBRARY</p><h1 style="font-size:24px;margin:0 0 16px">Access request update</h1><p>হ্যালো ${name},</p><p>আপনার <strong>${safeTool}</strong> access request review করা হয়েছে।</p><p>${safeBody}</p><p style="font-size:14px;color:#475569">${safeBatch}</p><p style="font-size:14px;color:#475569">তথ্য ভুল মনে হলে Support Library-তে একটি issue submit করুন।</p></div></div>`,
  });
}
