import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth-guard";
import { canMutate } from "@/lib/roles";

export const dynamic = "force-dynamic";

/**
 * Old address of the staff room page, now merged into `/dashboard/live-support`.
 *
 * Kept so a bookmark or old link still resolves. Students join from their own
 * request, so they go to their request list instead.
 */
export default async function SupportRedirectPage() {
  const session = await requireSession();

  if (session.user.role && canMutate(session.user.role)) {
    redirect("/dashboard/live-support");
  }
  redirect("/dashboard/my-issues");
}
