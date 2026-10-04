import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { listCases } from "@/lib/services/cases";
import { CASE_STATUSES } from "@/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.isActive === false) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;

  const result = await listCases({
    q: searchParams.get("q") ?? undefined,
    status: CASE_STATUSES.includes(status as never) ? status as never : undefined,
    tag: searchParams.get("tag") ?? undefined,
    page: Number(searchParams.get("page") ?? "1"),
    limit: Number(searchParams.get("limit") ?? "20"),
  });

  return NextResponse.json(result);
}
