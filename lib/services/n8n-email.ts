import "server-only";

import nodemailer from "nodemailer";

import type { N8nRequestType } from "@/models";

const escapeHtml = (value: string) =>
  value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] ?? character);

function transporter() {
  const port = Number(process.env.SMTP_PORT ?? "587");
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    service: process.env.SMTP_SERVICE || undefined,
    auth: { user: process.env.SMTP_MAIL, pass: process.env.SMTP_PASSWORD },
  });
}

export async function sendN8nHelpEmail(input: {
  to: string;
  studentName: string;
  requestType: N8nRequestType;
  link: string;
  requestId: string;
}) {  const reset = input.requestType === "PASSWORD_RESET";
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

  await transporter().sendMail({
    messageId: `<access-${input.requestId}@hablu-programmer.com>`,
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
}) {
  const name = escapeHtml(input.studentName);
  const email = escapeHtml(input.to);
  const text = `Your email (${input.to}) was added to the Hablu Programmer OpenAI API workspace invitation list. OpenAI sends the invitation separately — check your inbox and Spam/Promotions. Access is complete only after you accept that invitation. Sign in at https://platform.openai.com/ using this address. We never email API keys, so never share a key with anyone.`;

  await transporter().sendMail({
    messageId: `<openai-access-${input.requestId}@hablu-programmer.com>`,
    from: `Hablu Support Library <${process.env.SMTP_MAIL}>`,
    to: input.to,
    subject: "Your OpenAI workspace invitation was sent | Hablu Programmer",
    text: `Hi ${input.studentName},\n\n${text}\n\nIf you did not request this, reply to this email so we can review it.\n\nHablu Support Library`,
    html: `<div style="background:#f8fafc;padding:32px 16px;font-family:Arial,sans-serif;color:#0f172a"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px"><p style="color:#0891b2;font-weight:700;margin:0 0 12px">HABLU SUPPORT LIBRARY</p><h1 style="font-size:24px;margin:0 0 16px">Your OpenAI workspace invitation was sent</h1><p>Hi ${name},</p><p>Your email <strong>${email}</strong> was added to the Hablu Programmer OpenAI API workspace invitation list.</p><p>OpenAI sends its invitation separately, so check your inbox and Spam or Promotions. Access is complete only after you accept it.</p><p style="margin:28px 0"><a href="https://platform.openai.com/" style="background:#0891b2;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700">Open platform.openai.com</a></p><p style="font-size:14px;color:#475569">Sign in with this email address. We never email API keys, so never share a key with anyone.</p><p style="font-size:14px;color:#475569">If you did not request this, reply to this email so we can review it.</p></div></div>`,
  });
}
