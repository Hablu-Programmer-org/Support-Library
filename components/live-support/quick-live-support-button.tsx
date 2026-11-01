"use client";

import { joinLiveSupportQuickAction } from "@/actions/live-support";
import { ExternalActionForm } from "@/components/shared/external-action-form";
import { cn } from "@/lib/cn";
import {
  LIVE_SUPPORT_CTA,
  supportScheduleBn,
  type SupportPhase,
} from "@/lib/config/live-support";

type QuickLiveSupportButtonProps = {
  /** Resolved on the server: the browser clock is display only. */
  shift: SupportPhase;
  /** Whether this deployment has a room URL to redirect to. */
  configured: boolean;
  csrfToken: string;
};

const joinClass = cn(
  "inline-flex items-center justify-center gap-2 rounded-lg border border-primary/60 px-4 py-2 text-sm font-semibold text-primary transition",
  "hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950",
  "disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-transparent",
  "dark:disabled:border-slate-700 dark:disabled:text-slate-500",
);

const errorClass =
  "max-w-xs border-l-2 border-danger-500 pl-3 text-xs text-danger-700 dark:text-danger-300";

/**
 * "Join live support" shortcut on the issues page (owner decision, 2026-11-01).
 *
 * Students can already join from their own request, where the case is fixed and
 * they land in the staff queue. This button exists for the students who ask for
 * live help before submitting anything: it walks straight into the room with no
 * request, so it deliberately creates **no** queue row and no reference.
 *
 * The shift and the room come from the page (both resolved server-side); the
 * button only decides what is clickable. The room URL never reaches this
 * component — the action re-checks the shift, the role and the budget and only
 * then returns the URL, which `ExternalActionForm` opens in a new tab.
 *
 * The 2026-11-01 announcement asks students to submit a request *before* live
 * support. The request page is still the supported path; this button is kept as
 * an escape hatch, and its hint nudges the request-first journey instead of
 * telling students they need nothing.
 */
export function QuickLiveSupportButton({
  shift,
  configured,
  csrfToken,
}: QuickLiveSupportButtonProps) {
  const isOpen = shift !== "off";

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {!configured ? (
          "Live support is unavailable right now."
        ) : isOpen ? (
          "Live support is open right now."
        ) : (
          <>Closed right now · {supportScheduleBn}</>
        )}
      </p>

      <ExternalActionForm
        action={joinLiveSupportQuickAction}
        ariaLabel={LIVE_SUPPORT_CTA.join}
        className={joinClass}
        disabled={!isOpen || !configured}
        errorClassName={errorClass}
        fallbackLabel={LIVE_SUPPORT_CTA.open}
        fields={{ csrfToken }}
        hint={
          configured && isOpen
            ? "Opens in a new tab, so this list stays open. Tip: submit an issue first so a mentor can follow your case."
            : undefined
        }
        hintClassName="text-right"
        label={LIVE_SUPPORT_CTA.join}
        pendingLabel={LIVE_SUPPORT_CTA.pending}
      />
    </div>
  );
}
