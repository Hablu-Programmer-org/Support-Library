"use client";

import { useActionState } from "react";

import { createAccessRequestsForStudentAction } from "@/actions/n8n-requests";
import { PendingSubmitButton } from "@/components/issues/pending-submit-button";
import { GoogleReverifyButton } from "@/components/tool-access/google-reverify-button";
import { nativeFieldClass } from "@/lib/config/fields";
import { eyebrowClass } from "@/lib/ui";

const choices = [
  ["ACCESS", "n8n access"],
  ["PASSWORD_RESET", "n8n password reset"],
  ["OPENAI_ACCESS", "OpenAI API access"],
] as const;

/**
 * Collapsed-by-default manual creation. It sits above the queue so creating a
 * request never requires leaving the page, but stays out of the way while the
 * admin is processing the existing backlog.
 */
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
      className="group border-y border-slate-200 dark:border-slate-800"
      aria-labelledby="admin-create-access-heading"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2.5 py-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center text-slate-500 dark:text-slate-400">
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
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
        <span className="text-[11px] font-semibold text-slate-500 transition group-open:hidden dark:text-slate-400">
          Open
        </span>
        <span className="hidden text-[11px] font-semibold text-slate-500 group-open:inline dark:text-slate-400">
          Close
        </span>
      </summary>

      <form
        action={action}
        className="space-y-4 border-t border-slate-200 py-4 dark:border-slate-800"
      >
        <input name="csrfToken" type="hidden" value={csrfToken} />
        <div className="max-w-md">
          <label className={eyebrowClass} htmlFor="manual-access-email">
            Student email
          </label>
          <input
            autoComplete="off"
            className={`${nativeFieldClass} mt-1.5`}
            id="manual-access-email"
            name="email"
            placeholder="student@example.com"
            required
            type="email"
          />
        </div>
        <fieldset>
          <legend className={eyebrowClass}>Access to request</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {choices.map(([value, label]) => (
              <label
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm transition hover:border-cyan-300 has-checked:border-cyan-500 has-checked:bg-cyan-50 has-checked:ring-1 has-checked:ring-cyan-500/30 dark:border-slate-700 dark:hover:border-cyan-700 dark:has-checked:bg-cyan-950/40"
                key={value}
              >
                <input className="h-3.5 w-3.5 accent-cyan-600" name="requestTypes" type="checkbox" value={value} />
                <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {state.error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {state.error}
          </p>
        )}
        {state.success && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400" role="status">
            {state.success}
          </p>
        )}
        {/* Partial success: one request was created but another was refused. */}
        {state.warning && (
          <p className="text-sm text-amber-600 dark:text-amber-400" role="status">
            {state.warning}
          </p>
        )}
        <div className="max-w-xs">
          {requiresReauth || state.errorCode === "REAUTH_REQUIRED" ? (
            <GoogleReverifyButton />
          ) : (
            <PendingSubmitButton
              className="px-3 py-2 text-xs"
              fullWidth={false}
              label="Create selected requests"
              pendingLabel="Creating requests…"
            />
          )}
        </div>
      </form>
    </details>
  );
}
