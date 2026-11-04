"use client";

import { useActionState } from "react";

import { createAccessRequestsForStudentAction } from "@/actions/n8n-requests";
import { PendingSubmitButton } from "@/components/issues/pending-submit-button";
import { GoogleReverifyButton } from "@/components/tool-access/google-reverify-button";

const choices = [
  ["ACCESS", "n8n access"],
  ["PASSWORD_RESET", "n8n password reset"],
  ["OPENAI_ACCESS", "OpenAI API access"],
] as const;

export function AdminCreateAccessRequestForm({
  csrfToken,
  requiresReauth = false,
}: {
  csrfToken: string;
  requiresReauth?: boolean;
}) {
  const [state, action] = useActionState(createAccessRequestsForStudentAction, {});

  return (
    <details
      aria-labelledby="admin-create-access-heading"
      className="group rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-slate-700">
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="admin-create-access-heading" className="text-sm font-semibold text-slate-900 dark:text-white">
            Create requests manually
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Enter the Hablu Programmer account email and pick one or more access types.
          </p>
        </div>
        <span className="text-xs text-slate-500 group-open:hidden">Open</span>
        <span className="hidden text-xs text-slate-500 group-open:inline">Close</span>
      </summary>

      <form action={action} className="space-y-3 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="manual-access-email">
            Student email
          </label>
          <input
            id="manual-access-email"
            name="email"
            type="email"
            required
            autoComplete="off"
            placeholder="student@example.com"
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-cyan-500 dark:border-slate-700"
          />
        </div>
        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">Access to request</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {choices.map(([value, label]) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm transition hover:border-cyan-300 has-checked:border-cyan-500 has-checked:bg-cyan-50 has-checked:ring-1 has-checked:ring-cyan-500/30 dark:border-slate-700 dark:hover:border-cyan-700 dark:has-checked:bg-cyan-950/40"
              >
                <input className="h-3.5 w-3.5 accent-cyan-600" type="checkbox" name="requestTypes" value={value} />
                <span className="font-medium">{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
        {state.success && <p role="status" className="text-sm text-emerald-600">{state.success}</p>}
        <div className="max-w-xs">
          {requiresReauth || state.errorCode === "REAUTH_REQUIRED" ? (
            <GoogleReverifyButton />
          ) : (
            <PendingSubmitButton label="Create selected requests" pendingLabel="Creating requests…" className="px-3 py-2 text-xs" />
          )}
        </div>
      </form>
    </details>
  );
}
