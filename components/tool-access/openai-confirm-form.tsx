"use client";

import { useActionState } from "react";

import { confirmOpenAiAccessAction } from "@/actions/n8n-requests";
import { PendingSubmitButton } from "@/components/issues/pending-submit-button";

/**
 * OpenAI access has no link to send: the admin adds the copied email in the
 * OpenAI dashboard and then confirms here. The confirmation email originates
 * from Support Library, while OpenAI sends the workspace invitation itself.
 */
export function OpenAiConfirmForm({
  requestId,
  csrfToken,
}: {
  requestId: string;
  csrfToken: string;
}) {
  const [state, action] = useActionState(confirmOpenAiAccessAction, {});

  return (
    <form action={action} className="mt-4 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <input type="hidden" name="requestId" value={requestId} />
      <ol className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
        <li>1. Copy the student email above.</li>
        <li>2. Add that email as a member in the OpenAI dashboard.</li>
        <li>3. Confirm below — OpenAI invites them and we email a confirmation.</li>
      </ol>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p role="status" className="text-sm text-emerald-600">{state.success}</p>}
      <div className="max-w-xs">
        <PendingSubmitButton label="Confirm added & email student" pendingLabel="Confirming…" />
      </div>
    </form>
  );
}
