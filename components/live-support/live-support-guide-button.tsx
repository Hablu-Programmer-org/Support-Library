"use client";

import Link from "next/link";
import { useRef } from "react";

import { CloseIcon } from "@/components/icons";
import { QuickLiveSupportButton } from "@/components/live-support/quick-live-support-button";
import { cn } from "@/lib/cn";
import {
  LIVE_SUPPORT_CTA,
  supportScheduleBn,
  type SupportPhase,
} from "@/lib/config/live-support";

const triggerClass = cn(
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-primary/60 px-4 py-2 text-sm font-semibold text-primary transition",
  "hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950",
);

const steps = [
  {
    title: "Create an issue",
    body: "Describe the problem, the exact error and what you tried. You get a reference number.",
  },
  {
    title: "Open it during support hours",
    body: `Go to My issues, open your issue and select “${LIVE_SUPPORT_CTA.join}”.`,
  },
  {
    title: "Tell the mentor your reference number",
    body: "The mentor finds your issue with it and helps you from there.",
  },
] as const;

/**
 * "Join Live support" on the issues list and at the end of a library answer
 * (owner, 2026-11-23). Live support should start from the student's own issue, so
 * the dialog explains the three steps and links to Create an issue / My issues,
 * with a direct join (`join`) as the escape hatch. The trigger is always
 * enabled; the open/closed line comes from the server
 * (`liveSupportNow`) so it never disagrees with the join button on the issue.
 *
 * Native `<dialog>` + `showModal()`: focus is trapped and restored, Escape
 * closes it, and the page behind is inert, with no dialog library.
 */
export function LiveSupportGuideButton({
  statusLabel,
  join,
}: {
  statusLabel: string;
  /**
   * Direct join without a request (owner, 2026-11-23): the existing quick-join
   * action, which re-checks shift, role and budget server-side. Omit to hide.
   */
  join?: { csrfToken: string; shift: SupportPhase; configured: boolean };
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const close = () => dialogRef.current?.close();

  return (
    <>
      <button
        aria-haspopup="dialog"
        className={triggerClass}
        onClick={() => dialogRef.current?.showModal()}
        type="button"
      >
        {LIVE_SUPPORT_CTA.join}
      </button>

      <dialog
        aria-labelledby="live-support-guide-title"
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-slate-200 bg-white p-0 text-left text-slate-900 shadow-2xl backdrop:bg-slate-950/70 backdrop:backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900 dark:text-white"
        // A click on the backdrop lands on the dialog element itself.
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        ref={dialogRef}
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="live-support-guide-title" className="text-lg font-semibold">
                How to get live support
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{statusLabel}</p>
            </div>
            <button
              aria-label="Close"
              className="-m-2 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-cyan-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              onClick={close}
              type="button"
            >
              <CloseIcon aria-hidden="true" size={18} />
            </button>
          </div>

          <ol className="mt-5 space-y-4">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-sm font-semibold text-cyan-700 ring-1 ring-inset ring-cyan-500/30 dark:text-cyan-300"
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{step.title}</p>
                  <p className="mt-0.5 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <p className="mt-5 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            Daily hours:{" "}
            <span className="font-medium text-slate-700 dark:text-slate-300">{supportScheduleBn}</span>
          </p>

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            {join && (
              <div className="sm:mr-auto">
                <QuickLiveSupportButton
                  className="min-h-11"
                  configured={join.configured}
                  csrfToken={join.csrfToken}
                  shift={join.shift}
                />
              </div>
            )}
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              href="/dashboard/my-issues"
            >
              My issues
            </Link>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary-600"
              href="/dashboard/issues/new"
            >
              Create an issue
            </Link>
          </div>
        </div>
      </dialog>
    </>
  );
}
