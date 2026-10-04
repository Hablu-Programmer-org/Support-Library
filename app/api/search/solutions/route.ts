import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { listSolutions } from "@/lib/services/solutions";
import { SOLUTION_VISIBILITIES } from "@/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.isActive === false) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const visibility = searchParams.get("visibility") ?? undefined;

  const result = await listSolutions({
    q: searchParams.get("q") ?? undefined,
    tag: searchParams.get("tag") ?? undefined,
    visibility: SOLUTION_VISIBILITIES.includes(visibility as never) ? visibility as never : undefined,
    page: Number(searchParams.get("page") ?? "1"),
    limit: Number(searchParams.get("limit") ?? "20"),
  });

  return NextResponse.json(result);
}
