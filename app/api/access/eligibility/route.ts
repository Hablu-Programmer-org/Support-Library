import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getStudentAgentEnrollment } from "@/lib/services/n8n-requests";
import { agentEnrollmentAllows } from "@/lib/agent-enrollment-rules";
import { consumeRateLimit, MutationRateLimitError } from "@/lib/services/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

/**
 * API-level eligibility check for AI-tools access (n8n / OpenAI).
 *
 * The UI hides the "Help & access" card for students who are not in the `agent`
 * course, but that is a convenience, not a security boundary. This route is the
 * authoritative server-side answer: it re-runs the LMS enrollment check on every
 * request and never trusts a client-supplied course or batch.
 */
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
    await consumeRateLimit("access.eligibility", user.id);
    const enrollment = await getStudentAgentEnrollment(user.id);
    const eligible = agentEnrollmentAllows(enrollment);
    return NextResponse.json(
      {
        eligible,
        batchNo: eligible ? enrollment.batchNo : null,
      },
      { headers: NO_STORE },
    );
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
