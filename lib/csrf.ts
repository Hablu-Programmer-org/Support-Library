import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { auth } from "@/auth";

const CSRF_VERSION = "v1";
const CSRF_TTL_SECONDS = 60 * 60 * 8;

function csrfSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required for CSRF protection");
  return secret;
}

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createCsrfToken(
  userId: string,
  secret: string,
  now = Date.now(),
  nonce = randomBytes(18).toString("base64url"),
) {
  const expiresAt = Math.floor(now / 1000) + CSRF_TTL_SECONDS;
  const payload = `${CSRF_VERSION}.${expiresAt}.${nonce}.${userId}`;
  return `${CSRF_VERSION}.${expiresAt}.${nonce}.${signature(payload, secret)}`;
}

export function verifyCsrfToken(token: string, userId: string, secret: string, now = Date.now()) {
  const parts = token.split(".");
  if (parts.length !== 4) return false;
  const [version, expiresAtValue, nonce, suppliedSignature] = parts;
  const expiresAt = Number(expiresAtValue);
  if (
    version !== CSRF_VERSION ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt < Math.floor(now / 1000) ||
    !nonce ||
    !suppliedSignature
  ) return false;

  const payload = `${version}.${expiresAt}.${nonce}.${userId}`;
  const expected = Buffer.from(signature(payload, secret), "base64url");
  const supplied = Buffer.from(suppliedSignature, "base64url");
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export async function generateCsrfToken(userId: string): Promise<string> {
  return createCsrfToken(userId, csrfSecret());
}

export async function validateCsrfToken(token: string): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id || session.user.isActive === false) return false;
  return verifyCsrfToken(token, session.user.id, csrfSecret());
}
