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
    const body: { ok: boolean; ready: boolean; ts: string; release?: string } = {
      ok: true,
      ready: true,
      ts: new Date().toISOString(),
    };
    // The deployed revision is only disclosed outside production so the public
    // health endpoint cannot be used to fingerprint the exact commit in prod.
    if (process.env.NODE_ENV !== "production") {
      body.release = process.env.DEPLOYMENT_VERSION ?? "development";
    }
    return NextResponse.json(body);
  } catch {
    return NextResponse.json(
      { ok: false, ready: false, ts: new Date().toISOString() },
      { status: 503 },
    );
  }
}
