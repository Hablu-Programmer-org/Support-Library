import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getAccessRequestActivitySnapshot } from "@/lib/services/access-request-activity";
import { consumeRateLimit, MutationRateLimitError } from "@/lib/services/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.isActive === false) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }
  if (!session.user.canManageToolAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  }
  try {
    await consumeRateLimit("access.requests.activity", session.user.id);
    return NextResponse.json(await getAccessRequestActivitySnapshot(), { headers: NO_STORE });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof MutationRateLimitError ? "Too many requests" : "Unavailable" },
      {
        status: error instanceof MutationRateLimitError ? 429 : 503,
        headers: NO_STORE,
      },
    );
  }
}
