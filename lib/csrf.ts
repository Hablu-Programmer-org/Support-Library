"use server";

import { cookies } from "next/headers";
import { createHash } from "node:crypto";

export async function generateCsrfToken(): Promise<string> {
  const cookieStore = await cookies();
  const token = createHash("sha256").update(crypto.randomUUID()).digest("hex");
  cookieStore.set("csrf_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 8, // 8 hours
    path: "/",
  });
  return token;
}

export async function validateCsrfToken(token: string): Promise<boolean> {
  const cookieStore = await cookies();
  const storedToken = cookieStore.get("csrf_token")?.value;
  return storedToken === token;
}

export async function getCsrfToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get("csrf_token")?.value;
}