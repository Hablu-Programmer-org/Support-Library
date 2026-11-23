import { LiveSupportCard } from "@/components/live-support/live-support-card";
import { LiveSupportJoinQueue } from "@/components/live-support/join-queue";
import { QueueRefresh } from "@/components/live-support/queue-refresh";
import { PageHeader } from "@/components/shared/page-header";
import { requireMentorOrAdmin } from "@/lib/auth-guard";
import { currentShift, dayKeyInDhaka } from "@/lib/config/live-support";
import { generateCsrfToken } from "@/lib/csrf";
import { getLiveSupportConfig } from "@/lib/live-support";
import { listLiveSupportQueue } from "@/lib/services/live-support-joins";

export const dynamic = "force-dynamic";

/**
 * Staff live support: the room to join, and who is waiting in it today.
 *
 * The students themselves are in Google Meet, which this app cannot see, so the
 * queue is the bridge between "a student joined" and "the mentor knows which
 * request they are there for". A row is created when the student presses Join,
 * not when the request is submitted.
 *
 * Students join from their own request page (`/dashboard/issues/[id]`), so this
 * page is staff-only. `QueueRefresh` re-renders the whole page every 30s, which
 * also refreshes the shift and the CSRF token on the room card.
 */
export default async function LiveSupportPage() {
  const session = await requireMentorOrAdmin();

  const now = new Date();
  const dayKey = dayKeyInDhaka(now);
  // Resolved server-side so a wrong device clock cannot widen the window.
  const shift = currentShift(now);
  const roomOpen = shift !== "off";
  // The dial-in values follow the shift, so a closed room carries no room details.
  const { platform, meetingId, passcode, joinUrl } = getLiveSupportConfig();

  const [entries, csrfToken] = await Promise.all([
    listLiveSupportQueue(dayKey),
    generateCsrfToken(session.user.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 py-8">
      <PageHeader action={<QueueRefresh />} title="Live support" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        {/* First in DOM so the Join button sits above the queue on mobile. */}
        <aside className="lg:sticky lg:top-6 lg:order-last">
          <LiveSupportCard
            configured={Boolean(joinUrl)}
            csrfToken={csrfToken}
            meetingId={roomOpen ? meetingId : null}
            passcode={roomOpen ? passcode : null}
            platform={platform}
            shift={shift}
          />
        </aside>
        <div className="min-w-0">
          <LiveSupportJoinQueue dayKey={dayKey} entries={entries} />
        </div>
      </div>
    </div>
  );
}
