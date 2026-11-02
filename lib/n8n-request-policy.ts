import "server-only";

import { findLmsUserByEmail } from "@/lib/lms";

const N8N_ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN"]);
const MAX_ACCESS_LINK_LENGTH = 2048;

export function parseExactHosts(source?: string | null) {
  return (source ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

export async function isN8nAdmin(email?: string | null) {
  const user = await findLmsUserByEmail(email);
  return Boolean(user?.isActive && N8N_ADMIN_ROLES.has((user.role ?? "").toUpperCase()));
}

export function validateAccessLink(raw: string, provider: "n8n" | "openai") {
  const value = raw.trim();
  if (value.length > MAX_ACCESS_LINK_LENGTH) {
    throw new Error("The access link is too long.");
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Enter a valid ${provider === "n8n" ? "n8n" : "OpenAI"} link.`);
  }
  if (url.protocol !== "https:") throw new Error("The access link must use HTTPS.");
  if (url.username || url.password) throw new Error("The access link must not contain credentials.");

  const source = provider === "n8n"
    ? process.env.N8N_ALLOWED_LINK_HOSTS
    : (process.env.OPENAI_ALLOWED_LINK_HOSTS ?? "platform.openai.com");
  const hosts = parseExactHosts(source);
  if (hosts.length === 0 || !hosts.includes(url.hostname.toLowerCase())) {
    throw new Error(`This link is not from the configured ${provider === "n8n" ? "n8n" : "OpenAI"} host.`);
  }
  return url.toString();
}

export const validateN8nLink = (raw: string) => validateAccessLink(raw, "n8n");
