import { dbConnect } from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await dbConnect();
    return NextResponse.json({ ok: true, db: "up", ts: new Date().toISOString() });
  } catch {
    return NextResponse.json(
      { ok: false, db: "down", ts: new Date().toISOString() },
      { status: 503 },
    );
  }
}