import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const body: { ok: boolean; live: boolean; ts: string; release?: string } = {
    ok: true,
    live: true,
    ts: new Date().toISOString(),
  };
  // See /api/health: hide the deployed revision in production.
  if (process.env.NODE_ENV !== "production") {
    body.release = process.env.DEPLOYMENT_VERSION ?? "development";
  }
  return NextResponse.json(body);
}
