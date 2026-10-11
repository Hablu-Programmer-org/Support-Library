import { checkSupportReadiness } from "@/lib/db";
import { validateProductionEnv } from "@/lib/env";
import { checkLmsReadiness } from "@/lib/lms-db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
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
