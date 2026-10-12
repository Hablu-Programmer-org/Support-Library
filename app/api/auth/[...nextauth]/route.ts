import { handlers } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { getAuthRateLimitScope } from "@/lib/auth-rate-limit";
import { getClientIp } from "@/lib/client-ip";
import {
  consumeRateLimitByKey,
  MutationRateLimitError,
  RateLimitUnavailableError,
} from "@/lib/services/rate-limit";

export const runtime = "nodejs";

async function rateLimitCheck(request: NextRequest): Promise<NextResponse | null> {
  const scope = getAuthRateLimitScope(request.method, request.nextUrl.pathname);
  if (!scope) return null;

  const ip = getClientIp(request.headers);
  if (!ip && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Authentication is temporarily unavailable." }, {
      status: 503,
      headers: { "Retry-After": "5" },
    });
  }

  try {
    await consumeRateLimitByKey(scope, ip ?? "local-development");
  } catch (error) {
    if (error instanceof MutationRateLimitError) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }
    if (error instanceof RateLimitUnavailableError) {
      return NextResponse.json({ error: "Authentication is temporarily unavailable." }, {
        status: 503,
        headers: { "Retry-After": "5" },
      });
    }
    throw error;
  }

  return null;
}

export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimitCheck(request);
  if (rateLimitResponse) return rateLimitResponse;

  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimitCheck(request);
  if (rateLimitResponse) return rateLimitResponse;

  return handlers.POST(request);
}
