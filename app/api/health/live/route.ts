import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    ok: true,
    live: true,
    release: process.env.DEPLOYMENT_VERSION ?? "development",
    ts: new Date().toISOString(),
  });
}
