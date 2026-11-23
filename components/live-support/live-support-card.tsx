"use client";

import { joinLiveSupportAction } from "@/actions/live-support";
import { VideoIcon } from "@/components/icons";
import {
  LiveStatusPill,
  RoomDetails,
  ShiftSchedule,
  liveSupportCardClass,
  liveSupportErrorClass,
  liveSupportJoinClass,
} from "@/components/live-support/live-support-parts";
import { ExternalActionForm } from "@/components/shared/external-action-form";
import { LIVE_SUPPORT_CTA, type SupportPhase } from "@/lib/config/live-support";

type LiveSupportCardProps = {
  platform: string;
  /**
   * Manual entry fallback; absent while the room is closed.
   *
   * The current room platform has no passcode, so the two values render
   * independently.
   */
  meetingId?: string | null;
  passcode?: string | null;
  /** Whether this deployment has a room URL to redirect to. */
  configured: boolean;
  /** Resolved on the server: the browser clock is display only. */
  shift: SupportPhase;
  csrfToken: string;
};

/**
 * Staff join panel for the daily live support session.
 *
 * Students never see this page: they join from their own request, where the
 * request is fixed by the page. Staff run the session, so they need no request
 * and are not queued. The room URL is never held here — submitting the form runs
 * a server action that re-checks the shift and only then returns the URL, which
 * `ExternalActionForm` opens in a new tab (the queue tab stays open).
 *
 * Same layout as the student's `LiveSupportPanel` (shared parts).
 */
export function LiveSupportCard({
  platform,
  meetingId,
  passcode,
  configured,
  shift,
  csrfToken,
}: LiveSupportCardProps) {
  const isOpen = shift !== "off";

  return (
    <section aria-labelledby="live-support-room-heading" className={liveSupportCardClass}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="text-slate-400 dark:text-slate-500">
            <VideoIcon size={16} />
          </span>
          <h2
            id="live-support-room-heading"
            className="text-sm font-semibold text-slate-950 dark:text-white"
          >
            Support room
          </h2>
        </div>
        <LiveStatusPill open={isOpen} />
      </div>

      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
        You join as staff — no issue needed, and you are not added to the waiting list.
      </p>

      <div className="mt-4">
        <ShiftSchedule shift={shift} />
      </div>

      {!isOpen ? (
        <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">
          The room is closed right now. Join during one of the shifts above.
        </p>
      ) : null}
      {!configured ? (
        <p className="mt-3 text-sm font-medium text-danger-700 dark:text-danger-300">
          The support room is not configured for this deployment yet.
        </p>
      ) : null}

      {configured ? (
        <div className="mt-5">
          <ExternalActionForm
            action={joinLiveSupportAction}
            className={liveSupportJoinClass}
            disabled={!isOpen}
            errorClassName={liveSupportErrorClass}
            fallbackLabel={LIVE_SUPPORT_CTA.open}
            fields={{ csrfToken }}
            label={LIVE_SUPPORT_CTA.join}
            pendingLabel={LIVE_SUPPORT_CTA.pending}
          />
        </div>
      ) : null}

      {configured && isOpen ? (
        <RoomDetails className="mt-4" meetingId={meetingId} passcode={passcode} platform={platform} />
      ) : null}

      {configured ? (
        <ul className="mt-4 space-y-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
          <li>Ask each student for their issue reference and match it in Waiting students.</li>
          {isOpen ? <li>The room may ask you to sign in before letting you in.</li> : null}
        </ul>
      ) : null}
    </section>
  );
}
