import { checkSupportReadiness } from "@/lib/db";
import { validateProductionEnv } from "@/lib/env";
import { checkLmsReadiness } from "@/lib/lms-db";
import { NextResponse } from "next/server";
import { consumeRateLimitByKey } from "@/lib/services/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }
  return "unknown";
}

async function rateLimitCheck(request: Request): Promise<NextResponse | null> {
  const ip = getClientIp(request);
  const scope = "health.check";

  try {
    await consumeRateLimitByKey(scope, ip);
  } catch (error) {
    if (error instanceof Error && error.name === "MutationRateLimitError") {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }
  }
  return null;
}

export async function GET(request: Request) {
  const rateLimitResponse = await rateLimitCheck(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    validateProductionEnv();
    await Promise.all([checkSupportReadiness(), checkLmsReadiness()]);
    return NextResponse.json({
      ok: true,
      ready: true,
      release: process.env.DEPLOYMENT_VERSION ?? "development",
      ts: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { ok: false, ready: false, ts: new Date().toISOString() },
      { status: 503 },
    );
  }
}