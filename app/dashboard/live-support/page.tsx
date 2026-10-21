import { LiveSupportJoinQueue } from "@/components/live-support/join-queue";
import { QueueRefresh } from "@/components/live-support/queue-refresh";
import { PageHeader } from "@/components/shared/page-header";
import { requireMentorOrAdmin } from "@/lib/auth-guard";
import { dayKeyInDhaka, supportScheduleBn } from "@/lib/config/live-support";
import { listLiveSupportQueue } from "@/lib/services/live-support-joins";

export const dynamic = "force-dynamic";

/**
 * Staff view of the live support room: who took a request in, and when.
 *
 * The students themselves are in Zoom, which this app cannot see, so this page
 * is the bridge between "a student joined" and "the mentor knows which request
 * they are there for". A row is created when the student presses Join, not when
 * the request is submitted — so an empty page during a shift means nobody has
 * entered the room yet.
 */
export default async function LiveSupportQueuePage() {
  await requireMentorOrAdmin();

  const dayKey = dayKeyInDhaka(new Date());
  const entries = await listLiveSupportQueue(dayKey);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 py-8">
      <PageHeader
        action={<QueueRefresh />}
        description="Students who took one of their open requests into the room today."
        title="Live support queue"
      />
      <LiveSupportJoinQueue dayKey={dayKey} entries={entries} />
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Support hours: {supportScheduleBn}. A row appears here the moment a student presses Join on
        their request page — not when the request was submitted — so an empty list means nobody has
        entered the room yet. This page also checks again every 30 seconds while it is open.
      </p>
    </div>
  );
}
