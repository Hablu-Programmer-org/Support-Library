"use client";

import { useActionState } from "react";

import { createN8nRequestAction } from "@/actions/n8n-requests";
import { PendingSubmitButton } from "@/components/issues/pending-submit-button";

type RequestSummary = {
  id: string;
  requestType: "ACCESS" | "PASSWORD_RESET" | "OPENAI_ACCESS";
  status: "PENDING" | "PROCESSING" | "SENT" | "FAILED" | "SUPERSEDED";
  sentAt?: string | null;
};

const choices = [
  {
    value: "ACCESS",
    label: "n8n access",
    icon: "M13.5 10.5 21 3M21 3h-5.25M21 3v5.25M10.5 13.5 3 21M3 21h5.25M3 21v-5.25",
    hint: "I need an invitation to start using n8n.",
  },
  {
    value: "PASSWORD_RESET",
    label: "n8n password reset",
    icon: "M16.5 10.5V7a4.5 4.5 0 1 0-9 0v3.5M6.75 10.5h10.5a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5H6.75a1.5 1.5 0 0 1-1.5-1.5V12a1.5 1.5 0 0 1 1.5-1.5Z",
    hint: "I cannot sign in and need a reset link.",
  },
  {
    value: "OPENAI_ACCESS",
    label: "OpenAI API access",
    icon: "M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4",
    hint: "Invitation only — no API key is emailed.",
  },
] as const;

const active = (status: RequestSummary["status"]) => status === "PENDING" || status === "PROCESSING";

function StatusChip({ status, sentAt }: { status: RequestSummary["status"]; sentAt?: string | null }) {
  if (status === "SENT") {
    const date = sentAt
      ? new Date(sentAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : null;
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900">
        <span className="h-1 w-1 rounded-full bg-emerald-500" aria-hidden />
        Sent{date ? ` · ${date}` : ""}
      </span>
    );
  }
  if (status === "FAILED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900">
        <span className="h-1 w-1 rounded-full bg-red-500" aria-hidden />
        Failed
      </span>
    );
  }
  if (status === "SUPERSEDED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        Replaced
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900">
      <span className="h-1 w-1 animate-pulse rounded-full bg-amber-500" aria-hidden />
      {status === "PROCESSING" ? "Processing" : "Waiting"}
    </span>
  );
}

export function AccessHelpCard({ csrfToken, requests }: { csrfToken: string; requests: RequestSummary[] }) {
  const [state, action] = useActionState(createN8nRequestAction, {});
  const sentRequest = requests.find((request) => request.status === "SENT");

  return (
    <section
      aria-labelledby="access-help-heading"
      className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-cyan-400/0 via-cyan-400/70 to-indigo-400/0"
      />
      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-br from-cyan-500 to-indigo-600 text-white shadow-sm">
              <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.75 14.1 8l4.65.65-3.4 3.3.8 4.6L12 14.4l-4.15 2.15.8-4.6-3.4-3.3L9.9 8 12 3.75Z" />
              </svg>
            </span>
            <h2 id="access-help-heading" className="text-sm font-semibold text-slate-900 dark:text-white">
              Help &amp; access
            </h2>
            <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 sm:inline dark:bg-slate-800 dark:text-slate-400">
              n8n · OpenAI
            </span>
          </div>
          <span className="hidden text-[10px] text-slate-500 sm:inline dark:text-slate-400">
            OpenAI is invitation only — no API key is emailed.
          </span>
        </div>

        <form action={action} className="space-y-2.5">
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <fieldset className="grid gap-2 sm:flex sm:flex-wrap" aria-label="Choose access requests">
            <legend className="sr-only">Choose access requests</legend>
            {choices.map((choice) => {
              const latest = requests.find((request) => request.requestType === choice.value);
              const isActive = Boolean(latest && active(latest.status));
              return (
                <label
                  key={choice.value}
                  title={choice.hint}
                  className="group flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs transition hover:border-cyan-300 hover:bg-cyan-50/40 has-checked:border-cyan-500 has-checked:bg-cyan-50 has-checked:ring-1 has-checked:ring-cyan-500/30 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-cyan-700 dark:hover:bg-cyan-950/20 dark:has-checked:bg-cyan-950/40 sm:min-h-0"
                >
                  <input
                    className="h-3.5 w-3.5 shrink-0 accent-cyan-600"
                    type="checkbox"
                    name="requestTypes"
                    value={choice.value}
                    disabled={isActive}
                  />
                  <svg
                    aria-hidden
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.7}
                    className="hidden h-3.5 w-3.5 shrink-0 text-slate-400 group-has-checked:text-cyan-600 sm:block dark:text-slate-500"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={choice.icon} />
                  </svg>
                  <span className="truncate font-medium text-slate-700 dark:text-slate-200">{choice.label}</span>
                  {latest && <span className="ml-auto shrink-0"><StatusChip status={latest.status} sentAt={latest.sentAt} /></span>}
                </label>
              );
            })}
          </fieldset>

          {state.error && <p role="alert" className="text-xs text-red-600">{state.error}</p>}
          {state.success && <p role="status" className="text-xs text-emerald-600">{state.success}</p>}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10px] leading-4 text-slate-500 dark:text-slate-400">
              {sentRequest
                ? "Check Inbox and Spam/Promotions — n8n links expire, so use yours soon."
                : "Links are emailed to your registered address, usually within a day."}
            </p>
            <PendingSubmitButton
              label="Send selected requests"
              pendingLabel="Sending…"
              className="w-full sm:w-auto sm:px-4 sm:py-2"
            />
          </div>
        </form>
      </div>
    </section>
  );
}
