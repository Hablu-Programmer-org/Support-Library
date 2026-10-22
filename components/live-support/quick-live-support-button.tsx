"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import {
  joinLiveSupportQuickAction,
  type JoinLiveSupportState,
} from "@/actions/live-support";
import { CloseIcon, VideoIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import {
  supportHoursBn,
  supportScheduleBn,
  type SupportPhase,
} from "@/lib/config/live-support";

const INITIAL_STATE: JoinLiveSupportState = {};

type QuickLiveSupportButtonProps = {
  /** Resolved on the server: the browser clock is display only. */
  shift: SupportPhase;
  platform: string;
  csrfToken: string;
};

/**
 * TEMPORARY: a direct way into the live support room from the issues page.
 *
 * Context (owner request): students were not submitting a request before asking
 * for live help, so this button sits next to "Submit an issue", explains that a
 * request comes first, and still offers a join button. It is a stop-gap — the
 * request-first journey (`LiveSupportPanel` on the student's own request) stays
 * the real path, and this component plus `joinLiveSupportQuickAction` are meant
 * to be deleted together. Search for `TEMPORARY quick join`.
 *
 * The room URL is never rendered here: the panel posts to a server action that
 * re-checks the shift, the role and the rate limit before redirecting.
 */
export function QuickLiveSupportButton({
  shift,
  platform,
  csrfToken,
}: QuickLiveSupportButtonProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    joinLiveSupportQuickAction,
    INITIAL_STATE,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isOpen = shift !== "off";
  const canJoin = isOpen && !pending;

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    // Captured now, because the ref may point elsewhere by cleanup time.
    const trigger = triggerRef.current;

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      // Returning focus keeps keyboard users where they left off.
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="quick-live-support"
        title="Temporary: join the live support room directly"
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/60 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
      >
        <VideoIcon size={16} />
        Join live support
      </button>

      {open && (
        <div
          aria-labelledby="quick-live-support-heading"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
        >
          <button
            type="button"
            aria-label="Close live support dialog"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-slate-950/60 backdrop-blur-sm"
          />

          <div
            ref={panelRef}
            id="quick-live-support"
            tabIndex={-1}
            className="relative z-10 w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl outline-none dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-3">
              <h2
                id="quick-live-support-heading"
                className="text-lg font-semibold text-slate-900 dark:text-white"
              >
                Join live support
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close live support dialog"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300">
              Please <strong className="font-semibold">submit an issue first</strong> so the
              mentor can see your problem, follow it up after the call, and keep the answer for
              other students. You can still join the room directly below.
            </p>

            <p className="rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200">
              Temporary shortcut: this direct join will be removed soon. Submitting a request is
              the supported way to get live support.
            </p>

            <div className="space-y-1 text-sm">
              {isOpen ? (
                <p className="font-medium text-success-700 dark:text-success-300">
                  Live support is open right now.
                </p>
              ) : (
                <p className="font-medium text-danger-700 dark:text-danger-300">
                  Live support is closed right now. Please join during a support slot.
                </p>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Daily hours:{" "}
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {supportScheduleBn}
                </span>
              </p>
            </div>

            <Link
              className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
              href="/dashboard/issues/new"
            >
              Submit an issue
            </Link>

            <form action={formAction} className="space-y-2">
              <input type="hidden" name="csrfToken" value={csrfToken} />

              <button
                type="submit"
                aria-disabled={!canJoin}
                disabled={!canJoin}
                className={cn(
                  "inline-flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900",
                  canJoin
                    ? "border-primary text-primary hover:bg-primary/10"
                    : "cursor-not-allowed border-slate-200 text-slate-400 dark:border-slate-700 dark:text-slate-500",
                )}
              >
                <VideoIcon size={16} />
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

            <p className="text-xs text-slate-500 dark:text-slate-400">
              If you already submitted a request, say its reference out loud when you join. Total
              daily support time: {supportHoursBn()}.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
