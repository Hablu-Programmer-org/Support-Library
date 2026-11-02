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
}) {
  const reset = input.requestType === "PASSWORD_RESET";
  const title = reset ? "Reset your n8n password" : "Your n8n access is ready";
  const action = reset ? "Reset n8n password" : "Set up n8n access";
  const name = escapeHtml(input.studentName);
  const link = escapeHtml(input.link);
  const text = reset
    ? "Use the secure button below to choose a new password."
    : "Use the secure button below to accept your invitation and set up your n8n account.";

  await transporter().sendMail({
    from: `Hablu Support Library <${process.env.SMTP_MAIL}>`,
    to: input.to,
    subject: `${title} | Hablu Programmer`,
    text: `Hi ${input.studentName},\n\n${text}\n\n${action}: ${input.link}\n\nThis link may expire, so use it soon. If you did not request this, ignore this email. Never share this link.\n\nHablu Support Library`,
    html: `<div style="background:#f8fafc;padding:32px 16px;font-family:Arial,sans-serif;color:#0f172a"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px"><p style="color:#0891b2;font-weight:700;margin:0 0 12px">HABLU SUPPORT LIBRARY</p><h1 style="font-size:24px;margin:0 0 16px">${title}</h1><p>Hi ${name},</p><p>${text}</p><p style="margin:28px 0"><a href="${link}" style="background:#0891b2;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700">${action}</a></p><p style="font-size:14px;color:#475569">This link may expire, so use it soon. Never share it with anyone.</p><p style="font-size:14px;color:#475569">If you did not request this, you can safely ignore this email.</p></div></div>`,
  });
}
