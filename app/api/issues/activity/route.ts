import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { canMutate } from "@/lib/roles";
import { getIssueActivitySnapshot } from "@/lib/services/issue-activity";
import { consumeRateLimit, MutationRateLimitError } from "@/lib/services/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cheap, staff-only change signal for the issue list.
 *
 * The response deliberately contains no issue content — only a revision token
 * and a count — so a polling client (or a hijacked session) learns nothing about
 * students, titles or replies. `router.refresh()` then re-runs every server-side
 * authorization check; the client never injects data.
 */
const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.isActive === false) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }
  if (!session.user.role || !canMutate(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  }
  try {
    await consumeRateLimit("issues.activity", session.user.id);
    const snapshot = await getIssueActivitySnapshot();
    return NextResponse.json(snapshot, { headers: NO_STORE });
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
