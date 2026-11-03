"use client";

import { useActionState, useState } from "react";

import { confirmOpenAiAccessAction } from "@/actions/n8n-requests";
import { CheckCircleIcon } from "@/components/icons";
import { PendingSubmitButton } from "@/components/issues/pending-submit-button";
import { GoogleReverifyButton } from "@/components/tool-access/google-reverify-button";

/**
 * OpenAI access has no link to send: the admin adds the copied email in the
 * OpenAI dashboard and then confirms here. The confirmation email originates
 * from Support Library, while OpenAI sends the workspace invitation itself.
 */
export function OpenAiConfirmForm({
  requestId,
  csrfToken,
  requiresReauth = false,
}: {
  requestId: string;
  csrfToken: string;
  requiresReauth?: boolean;
}) {
  const [state, action] = useActionState(confirmOpenAiAccessAction, {});
  const [confirmed, setConfirmed] = useState(false);
  const needsReauth = requiresReauth || state.errorCode === "REAUTH_REQUIRED";

  return (
    <form action={action} className="min-w-0">
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <input type="hidden" name="requestId" value={requestId} />
      <div className="flex min-w-0 items-center justify-end gap-2 max-[359px]:flex-col max-[359px]:items-stretch">
        {needsReauth ? (
          <GoogleReverifyButton />
        ) : (
          <>
            <label className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] font-medium text-slate-600 transition hover:border-cyan-300 hover:bg-cyan-50/60 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:border-cyan-700 dark:hover:bg-cyan-950/20">
              <input
                checked={confirmed}
                className="h-4 w-4 shrink-0 rounded border-slate-300 accent-cyan-600 dark:border-slate-600"
                name="confirmed"
                onChange={(event) => setConfirmed(event.target.checked)}
                type="checkbox"
                value="yes"
              />
              Added this exact email
            </label>
            <PendingSubmitButton
              className="w-auto shrink-0 px-3 py-2 text-xs shadow-sm disabled:shadow-none"
              disabled={!confirmed}
              label="Confirm & email student"
              leadingIcon={<CheckCircleIcon size={14} />}
              pendingLabel="Confirming…"
            />
          </>
        )}
      </div>
      {state.error && <p role="alert" className="mt-1.5 text-xs text-red-600">{state.error}</p>}
      {state.success && <p role="status" className="mt-1.5 text-xs text-emerald-600">{state.success}</p>}
    </form>
  );
}
