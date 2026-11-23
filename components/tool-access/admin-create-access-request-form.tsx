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
 * Manual request creation. Rendered inside the slide-over
 * (`CreateAccessRequestPanel`) so the queue stays visible behind it.
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
    <form action={action} className="space-y-5">
      <input name="csrfToken" type="hidden" value={csrfToken} />
      <div>
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
        <div className="mt-2 grid gap-2">
          {choices.map(([value, label]) => (
            <label
              className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 text-sm transition hover:border-cyan-300 has-checked:border-cyan-500 has-checked:bg-cyan-50 has-checked:ring-1 has-checked:ring-cyan-500/30 dark:border-slate-700 dark:hover:border-cyan-700 dark:has-checked:bg-cyan-950/40"
              key={value}
            >
              <input className="h-4 w-4 accent-cyan-600" name="requestTypes" type="checkbox" value={value} />
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
      {requiresReauth || state.errorCode === "REAUTH_REQUIRED" ? (
        <GoogleReverifyButton />
      ) : (
        <PendingSubmitButton label="Create requests" pendingLabel="Creating requests…" />
      )}
    </form>
  );
}
