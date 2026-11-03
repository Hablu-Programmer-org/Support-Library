import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getOwnIssueActivitySnapshot } from "@/lib/services/issue-activity";
import { consumeRateLimit, MutationRateLimitError } from "@/lib/services/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cheap, student-scoped change signal for "My requests".
 *
 * The response contains only a revision token and a count — no titles, replies
 * or counts of other students' cases — because the caller is identified by the
 * session, never by a query parameter. `router.refresh()` then re-runs every
 * server-side ownership check, so the client never receives data it could not
 * have fetched itself.
 */
const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export async function GET() {
  const session = await auth();
  const user = session?.user;
  if (!user || user.isActive === false) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }
  if (user.role !== "STUDENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  }
  try {
    await consumeRateLimit("my-requests.activity", user.id);
    const snapshot = await getOwnIssueActivitySnapshot(user.id);
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
