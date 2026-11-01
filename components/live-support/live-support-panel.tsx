"use client";

import { joinLiveSupportAction } from "@/actions/live-support";
import { ExternalActionForm } from "@/components/shared/external-action-form";
import { cn } from "@/lib/cn";
import {
  LIVE_SUPPORT_CTA,
  meetingCodeLabel,
  supportHoursBn,
  supportScheduleBn,
  type SupportPhase,
} from "@/lib/config/live-support";
import { LIVE_SUPPORT_ELIGIBLE_STATUSES, type CaseStatus } from "@/lib/constants";

type LiveSupportPanelProps = {
  issueId: string;
  status: CaseStatus;
  platform: string;
  /** Resolved on the server: the browser clock is display only. */
  shift: SupportPhase;
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

const SHIFT_LABELS: Record<Exclude<SupportPhase, "off">, string> = {
  morning: "Morning shift",
  night: "Night shift",
};

const ORDER: Array<Exclude<SupportPhase, "off">> = ["morning", "night"];

const joinClass = cn(
  "inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition",
  "bg-primary text-white hover:bg-primary-600",
  "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950",
  "disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:hover:bg-slate-200",
  "dark:disabled:bg-slate-800 dark:disabled:text-slate-400",
);

const errorClass = "border-l-2 border-danger-500 pl-3 text-sm text-danger-700 dark:text-danger-300";

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
  meetingId,
  passcode,
  configured,
  csrfToken,
}: LiveSupportPanelProps) {
  const isOpen = shift !== "off";
  const isEligible = (LIVE_SUPPORT_ELIGIBLE_STATUSES as readonly string[]).includes(status);

  return (
    <section
      aria-labelledby="live-support-panel-heading"
      className="space-y-5 border-t border-slate-200 pt-6 dark:border-slate-800"
    >
      <div className="space-y-1">
        <h2
          id="live-support-panel-heading"
          className="text-lg font-semibold text-slate-900 dark:text-white"
        >
          Live support
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {isEligible
            ? "Take this request into the support room and share your screen with the mentor."
            : "This request is closed, so it can no longer be taken to the room. Submit a new request if the problem comes back."}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Requests can be submitted 24/7; the room is open only during a support shift.
        </p>
      </div>

      <div className="flex items-center gap-3">
        {ORDER.map((item) => (
          // Display-only chips (they carry no action), so they are inert.
          <button
            key={item}
            type="button"
            aria-label={`${SHIFT_LABELS[item]} button`}
            className={cn(
              "rounded-full px-6 py-2.5 text-sm font-semibold transition",
              shift === item
                ? "bg-primary text-white"
                : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
            )}
            disabled
          >
            {SHIFT_LABELS[item]}
          </button>
        ))}
      </div>

      <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
        {isOpen ? (
          <p className="font-medium text-success-700 dark:text-success-300">
            Live support is open right now.
          </p>
        ) : (
          <p className="font-medium text-danger-700 dark:text-danger-300">
            Live support is closed right now. Please join during a support slot.
          </p>
        )}
        {!configured && (
          <p className="font-medium text-danger-700 dark:text-danger-300">
            The support room is not configured for this deployment yet.
          </p>
        )}
        <p className="text-slate-500 dark:text-slate-400">
          Daily hours:{" "}
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {supportScheduleBn}
          </span>
        </p>
      </div>

      {isEligible && configured && (
        <ExternalActionForm
          action={joinLiveSupportAction}
          className={joinClass}
          disabled={!isOpen}
          errorClassName={errorClass}
          fallbackLabel={LIVE_SUPPORT_CTA.open}
          fields={{ csrfToken, issueId }}
          hint="Opens in a new tab, so this request page stays open."
          label={LIVE_SUPPORT_CTA.join}
          pendingLabel={LIVE_SUPPORT_CTA.pending}
        />
      )}

      {isEligible && isOpen && configured && (meetingId || passcode) && (
        <div className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {meetingId && (
            <div className="flex items-center justify-between gap-4 py-3">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {meetingCodeLabel(platform)}
              </span>
              <span className="select-all text-sm font-semibold text-slate-900 dark:text-white">
                {meetingId}
              </span>
            </div>
          )}
          {passcode && (
            <div className="flex items-center justify-between gap-4 py-3">
              <span className="text-sm text-slate-500 dark:text-slate-400">Passcode</span>
              <span className="select-all text-sm font-semibold text-slate-900 dark:text-white">
                {passcode}
              </span>
            </div>
          )}
        </div>
      )}

      {isEligible && isOpen && configured && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          You may be asked to sign in before the room lets you in.
        </p>
      )}

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Say the request reference above when you join — the mentor sees the same reference in the
        waiting list. Total daily support time: {supportHoursBn()}.
      </p>
    </section>
  );
}
