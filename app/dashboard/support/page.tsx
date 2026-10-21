import Link from "next/link";
import { redirect } from "next/navigation";

import { LiveSupportCard } from "@/components/live-support/live-support-card";
import { PageHeader } from "@/components/shared/page-header";
import { requireSession } from "@/lib/auth-guard";
import { currentShift } from "@/lib/config/live-support";
import { generateCsrfToken } from "@/lib/csrf";
import { getLiveSupportConfig } from "@/lib/live-support";
import { canMutate } from "@/lib/roles";

export const dynamic = "force-dynamic";

/**
 * Staff entry to the live support room.
 *
 * Students join from their own request page (`/dashboard/issues/[id]`), where the
 * request is fixed, so this page sends them to their request list instead. Staff
 * run the session and need no request.
 */
export default async function LiveSupportPage() {
  const session = await requireSession();

  if (!session.user.role || !canMutate(session.user.role)) {
    redirect("/dashboard/my-requests");
  }

  // Resolved server-side so a wrong device clock cannot widen the window.
  const shift = currentShift(new Date());
  const csrfToken = await generateCsrfToken(session.user.id);
  // The dial-in values follow the shift, so a closed room carries no room details.
  const { platform, meetingId, passcode } = getLiveSupportConfig();
  const roomOpen = shift !== "off";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 py-8">
      <PageHeader
        action={
          <Link
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            href="/dashboard/live-support"
          >
            Waiting students
          </Link>
        }
        description="Join the room, then check who is waiting and for which request."
        title="Live support"
      />
      <LiveSupportCard
        csrfToken={csrfToken}
        meetingId={roomOpen ? meetingId : undefined}
        passcode={roomOpen ? passcode : undefined}
        platform={platform}
        shift={shift}
      />
    </div>
  );
}
