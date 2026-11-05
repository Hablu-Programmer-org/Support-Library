import "server-only";

import { auth } from "@/auth";
import { verifyCsrfTokenForUser } from "@/lib/csrf";
import { getRequestContext } from "@/lib/request-context";
import { recentlySignedIn } from "@/lib/recent-auth";

export type ToolAccessAuthorization =
  | {
      ok: true;
      actor: { id: string; email: string };
      context: Awaited<ReturnType<typeof getRequestContext>>;
    }
  | {
      ok: false;
      state: {
        error: string;
        errorCode?: "REAUTH_REQUIRED";
      };
    };

/**
 * One fresh Auth.js/LMS resolution per sensitive access decision. The
 * capability is derived from the exact LMS role during that same resolution;
 * the broader local ADMIN mapping is deliberately insufficient.
 */
export async function authorizeToolAccessDecision(
  formData: FormData,
): Promise<ToolAccessAuthorization> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email || session.user.isActive === false) {
    return { ok: false, state: { error: "Your session expired. Refresh and try again." } };
  }
  if (!session.user.canManageToolAccess) {
    return { ok: false, state: { error: "You do not have permission to manage access requests." } };
  }

  const token = formData.get("csrfToken");
  if (
    typeof token !== "string" ||
    !verifyCsrfTokenForUser(token, session.user.id)
  ) {
    return { ok: false, state: { error: "Your session expired. Refresh and try again." } };
  }
  if (!(await recentlySignedIn(session.user.id))) {
    return {
      ok: false,
      state: { error: "Verify with Google to continue.", errorCode: "REAUTH_REQUIRED" },
    };
  }

  return {
    ok: true,
    actor: { id: session.user.id, email: session.user.email },
    context: await getRequestContext(),
  };
}
