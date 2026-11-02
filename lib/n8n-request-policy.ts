import "server-only";

import { findLmsUserByEmail } from "@/lib/lms";

const N8N_ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN"]);

export async function isN8nAdmin(email?: string | null) {
  const user = await findLmsUserByEmail(email);
  return Boolean(user?.isActive && N8N_ADMIN_ROLES.has((user.role ?? "").toUpperCase()));
}

export function validateN8nLink(raw: string) {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Enter a valid n8n link.");
  }
  if (url.protocol !== "https:") throw new Error("The n8n link must use HTTPS.");
  if (url.username || url.password) throw new Error("The n8n link must not contain credentials.");

  const hosts = (process.env.N8N_ALLOWED_LINK_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  if (hosts.length === 0 || !hosts.includes(url.hostname.toLowerCase())) {
    throw new Error("This link is not from the configured n8n host.");
  }
  return url.toString();
}
