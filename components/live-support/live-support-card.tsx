"use client";

import { useActionState } from "react";

import { joinLiveSupportAction, type JoinLiveSupportState } from "@/actions/live-support";
import { cn } from "@/lib/cn";
import { supportHoursBn, supportScheduleBn, type SupportPhase } from "@/lib/config/live-support";

type LiveSupportCardProps = {
  platform: string;
  /** Manual dial-in fallback; absent while the room is closed. */
  meetingId?: string;
  passcode?: string;
  /** Resolved on the server: the browser clock is display only. */
  shift: SupportPhase;
  csrfToken: string;
};

const SHIFT_LABELS: Record<Exclude<SupportPhase, "off">, string> = {
  morning: "Morning shift",
  night: "Night shift",
};

const ORDER: Array<Exclude<SupportPhase, "off">> = ["morning", "night"];

const INITIAL_STATE: JoinLiveSupportState = {};

/**
 * Staff join panel for the daily live support session.
 *
 * Students never see this page: they join from their own request, where the
 * request is fixed by the page. Staff run the session, so they need no request
 * and are not queued. The room URL is never held here — submitting the form runs
 * a server action that re-checks the shift and only then redirects.
 */
export function LiveSupportCard({
  platform,
  meetingId,
  passcode,
  shift,
  csrfToken,
}: LiveSupportCardProps) {
  const [state, formAction, pending] = useActionState(joinLiveSupportAction, INITIAL_STATE);
  const isOpen = shift !== "off";
  const joinLabel = `Live Support Center (${platform})`;
  const joinClass = cn(
    "inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950",
    isOpen && !pending
      ? "bg-primary text-white hover:bg-primary-600"
      : "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  );

  return (
    <div className="space-y-6">
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
        <p className="text-slate-500 dark:text-slate-400">
          Daily hours:{" "}
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {supportScheduleBn}
          </span>
        </p>
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-300">
        You are joining as staff — no request is required and you will not appear in the waiting
        list.
      </p>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="csrfToken" value={csrfToken} />

        <button
          type="submit"
          aria-label={joinLabel}
          aria-disabled={!isOpen || pending}
          className={joinClass}
          disabled={!isOpen || pending}
        >
          {pending ? "Opening the room…" : `Join ${platform} Meeting`}
        </button>

        {state.error && (
          <p
            role="alert"
            className="border-l-2 border-danger-500 pl-3 text-sm text-danger-700 dark:text-danger-300"
          >
            {state.error}
          </p>
        )}
      </form>

      {isOpen && meetingId && passcode && (
        <div className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          <div className="flex items-center justify-between gap-4 py-3">
            <span className="text-sm text-slate-500 dark:text-slate-400">Meeting ID</span>
            <span className="select-all text-sm font-semibold text-slate-900 dark:text-white">
              {meetingId}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <span className="text-sm text-slate-500 dark:text-slate-400">Passcode</span>
            <span className="select-all text-sm font-semibold text-slate-900 dark:text-white">
              {passcode}
            </span>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Say the request reference out loud when you let the student in. Total daily support time:{" "}
        {supportHoursBn()}.
      </p>
    </div>
  );
}
