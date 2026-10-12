"use server";

import { headers } from "next/headers";
import { getClientIp } from "@/lib/client-ip";

export interface RequestContext {
  ip: string | undefined;
  userAgent: string | undefined;
  requestId: string | undefined;
}

export async function getRequestContext(): Promise<RequestContext> {
  const headersList = await headers();
  
  const ip = getClientIp(headersList);

  // Get user agent
  const userAgent = headersList.get("user-agent") || undefined;

  // Get or generate request ID
  const requestId = headersList.get("x-request-id") || crypto.randomUUID();

  return { ip, userAgent, requestId };
}
