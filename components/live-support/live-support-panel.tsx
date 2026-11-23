"use client";

import { joinLiveSupportAction } from "@/actions/live-support";
import { VideoIcon } from "@/components/icons";
import { CopyValue } from "@/components/shared/copy-value";
import { ExternalActionForm } from "@/components/shared/external-action-form";
import { cn } from "@/lib/cn";
import {
  LIVE_SUPPORT_CTA,
  meetingCodeLabel,
  shiftRangeLabel,
  type SupportPhase,
  type SupportShift,
} from "@/lib/config/live-support";
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

const SHIFTS: Array<{ id: SupportShift; label: string }> = [
  { id: "morning", label: "Morning" },
  { id: "night", label: "Night" },
];

const joinClass = cn(
  "inline-flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition",
  "bg-primary text-white hover:bg-primary-600",
  "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950",
  "disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:hover:bg-slate-200",
  "dark:disabled:bg-slate-800 dark:disabled:text-slate-400",
);

const errorClass = "border-l-2 border-danger-500 pl-3 text-sm text-danger-700 dark:text-danger-300";

function StatusPill({ open }: { open: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        open
          ? "bg-success-500/15 text-success-700 dark:text-success-300"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", open ? "bg-success-500" : "bg-slate-400")}
      />
      {open ? "Open now" : "Closed"}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-sm text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-sm font-semibold text-slate-900 dark:text-white">
        <CopyValue label={label.toLowerCase()} value={value} />
      </dd>
    </div>
  );
}

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
  const showRoomDetails = canJoin && isOpen && Boolean(meetingId || passcode);

  return (
    <section
      aria-labelledby="live-support-panel-heading"
      // Same card as the rest of the request sidebar it sits in.
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70"
    >
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
        <StatusPill open={isOpen} />
      </div>

      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
        {isEligible
          ? "Share your screen with a mentor and solve this issue together."
          : "This issue is closed, so it can no longer be taken to the room. Submit a new issue if the problem comes back."}
      </p>

      <ul aria-label="Daily support hours" className="mt-4 space-y-2">
        {SHIFTS.map(({ id, label }) => {
          const current = shift === id;
          return (
            <li
              key={id}
              aria-current={current ? "time" : undefined}
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm",
                current
                  ? "border-primary-500/40 bg-primary-500/10"
                  : "border-slate-200 dark:border-slate-800",
              )}
            >
              <span
                className={cn(
                  "font-medium",
                  current
                    ? "text-primary-700 dark:text-primary-300"
                    : "text-slate-700 dark:text-slate-300",
                )}
              >
                {label}
                {current ? <span className="sr-only"> (now)</span> : null}
              </span>
              <span
                className={cn(
                  "tabular-nums",
                  current
                    ? "font-semibold text-slate-900 dark:text-white"
                    : "text-slate-500 dark:text-slate-400",
                )}
              >
                {shiftRangeLabel(id)}
              </span>
            </li>
          );
        })}
      </ul>

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

      {canJoin ? (
        <div className="mt-5">
          <ExternalActionForm
            action={joinLiveSupportAction}
            className={joinClass}
            disabled={!isOpen}
            errorClassName={errorClass}
            fallbackLabel={LIVE_SUPPORT_CTA.open}
            fields={{ csrfToken, issueId }}
            label={LIVE_SUPPORT_CTA.join}
            pendingLabel={LIVE_SUPPORT_CTA.pending}
          />
        </div>
      ) : null}

      {showRoomDetails ? (
        <dl className="mt-4 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {meetingId ? <DetailRow label={meetingCodeLabel(platform)} value={meetingId} /> : null}
          {passcode ? <DetailRow label="Passcode" value={passcode} /> : null}
        </dl>
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
