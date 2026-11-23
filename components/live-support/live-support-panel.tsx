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
import { LIVE_SUPPORT_ELIGIBLE_STATUSES, type CaseStatus } from "@/lib/constants";

type LiveSupportPanelProps = {
  issueId: string;
  status: CaseStatus;
  platform: string;
  /** Resolved on the server: the browser clock is display only. */
  shift: SupportPhase;
  /** The request reference the student says when joining. */
  caseRef?: string | null;
  /**
   * Manual entry fallback; absent while the room is closed.
   *
   * The current room platform has no passcode, so both values are optional and
   * are rendered as separate rows — an absent passcode must not hide the
   * meeting code.
   */
  meetingId?: string | null;
  passcode?: string | null;
  /** Whether this deployment has a room URL to redirect to. */
  configured: boolean;
  csrfToken: string;
};

/**
 * "Take this request to the room" panel, rendered on the student's own request.
 *
 * The request is fixed by the page (a hidden field), so there is no picker and
 * no way to serialise a different case from the UI. Eligibility and the shift
 * are still re-checked inside the action — this panel only decides what the
 * student sees. Opening the room in a new tab is handled generically by
 * `ExternalActionForm`.
 */
export function LiveSupportPanel({
  issueId,
  status,
  platform,
  shift,
  caseRef,
  meetingId,
  passcode,
  configured,
  csrfToken,
}: LiveSupportPanelProps) {
  const isOpen = shift !== "off";
  const isEligible = (LIVE_SUPPORT_ELIGIBLE_STATUSES as readonly string[]).includes(status);
  const canJoin = isEligible && configured;

  return (
    <section aria-labelledby="live-support-panel-heading" className={liveSupportCardClass}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="text-slate-400 dark:text-slate-500">
            <VideoIcon size={16} />
          </span>
          <h2
            id="live-support-panel-heading"
            className="text-sm font-semibold text-slate-950 dark:text-white"
          >
            Live support
          </h2>
        </div>
        <LiveStatusPill open={isOpen} />
      </div>

      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
        {isEligible
          ? "Share your screen with a mentor and solve this issue together."
          : "This issue is closed, so it can no longer be taken to the room. Submit a new issue if the problem comes back."}
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
        <p className="mt-3 text-sm font-medium text-danger-700 dark:text-danger-600">
          The support room is not configured for this deployment yet.
        </p>
      ) : null}

      {canJoin ? (
        <div className="mt-5">
          <ExternalActionForm
            action={joinLiveSupportAction}
            className={liveSupportJoinClass}
            disabled={!isOpen}
            errorClassName={liveSupportErrorClass}
            fallbackLabel={LIVE_SUPPORT_CTA.open}
            fields={{ csrfToken, issueId }}
            label={LIVE_SUPPORT_CTA.join}
            pendingLabel={LIVE_SUPPORT_CTA.pending}
          />
        </div>
      ) : null}

      {canJoin && isOpen ? (
        <RoomDetails className="mt-4" meetingId={meetingId} passcode={passcode} platform={platform} />
      ) : null}

      {canJoin ? (
        <ul className="mt-4 space-y-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
          <li>
            {caseRef ? (
              <>
                Tell the mentor your reference{" "}
                <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                  {caseRef}
                </span>{" "}
                — it&apos;s how they find you in the waiting list.
              </>
            ) : (
              "Tell the mentor your issue reference — it's how they find you in the waiting list."
            )}
          </li>
          {isOpen ? <li>The room may ask you to sign in before letting you in.</li> : null}
        </ul>
      ) : null}
    </section>
  );
}
