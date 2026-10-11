import { handlers } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimitByKey } from "@/lib/services/rate-limit";

export const runtime = "nodejs";

function getClientIp(request: NextRequest): string {
  // Check for forwarded IP (behind proxy)
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  // Check for real IP header
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }
  // Fallback to a default
  return "unknown";
}

async function rateLimitCheck(request: NextRequest): Promise<NextResponse | null> {
  const ip = getClientIp(request);
  const scope = "oauth.callback";

  try {
    await consumeRateLimitByKey(scope, ip);
  } catch (error) {
    if (error instanceof Error && error.name === "MutationRateLimitError") {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }
    // For other errors, allow the request through (fail open for auth)
    console.warn("OAuth callback rate limit check failed:", error);
  }

  return null;
}

// Wrapper for GET requests (OAuth callback)
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimitCheck(request);
  if (rateLimitResponse) return rateLimitResponse;

  return handlers.GET(request);
}

// Wrapper for POST requests (if needed)
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimitCheck(request);
  if (rateLimitResponse) return rateLimitResponse;

  return handlers.POST(request);
}