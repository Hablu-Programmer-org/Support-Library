"use server";

import { headers } from "next/headers";

export interface RequestContext {
  ip: string | undefined;
  userAgent: string | undefined;
  requestId: string | undefined;
}

export async function getRequestContext(): Promise<RequestContext> {
  const headersList = await headers();
  
  // Get client IP
  const forwarded = headersList.get("x-forwarded-for");
  const realIp = headersList.get("x-real-ip");
  const ip = forwarded?.split(",")[0]?.trim() || realIp || undefined;

  // Get user agent
  const userAgent = headersList.get("user-agent") || undefined;

  // Get or generate request ID
  const requestId = headersList.get("x-request-id") || crypto.randomUUID();

  return { ip, userAgent, requestId };
}