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
      <div className="flex min-w-0 items-center justify-end gap-2 max-[420px]:flex-col max-[420px]:items-stretch">
        {needsReauth ? (
          <GoogleReverifyButton />
        ) : (
          <>
            <label className="inline-flex min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] font-medium text-slate-600 transition hover:border-cyan-300 hover:bg-cyan-50/60 max-[420px]:justify-start dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:border-cyan-700 dark:hover:bg-cyan-950/20">
              <input
                checked={confirmed}
                className="h-4 w-4 shrink-0 rounded border-slate-300 accent-cyan-600 dark:border-slate-600"
                name="confirmed"
                onChange={(event) => setConfirmed(event.target.checked)}
                type="checkbox"
                value="yes"
              />
              <span className="min-w-0 whitespace-nowrap">Added this exact email</span>
            </label>
            <PendingSubmitButton
              className="px-3 py-2 text-xs shadow-sm disabled:shadow-none"
              disabled={!confirmed}
              fullWidth={false}
              label="Confirm & email student"
              leadingIcon={<CheckCircleIcon size={14} />}
              pendingLabel="Confirming…"
            />
          </>
        )}
      </div>
      {state.error && (
        <p
          id={`openai-error-${requestId}`}
          role="alert"
          className="mt-1.5 wrap-break-word text-xs text-red-600"
        >
          {state.error}
        </p>
      )}
      {state.success && (
        <p
          id={`openai-success-${requestId}`}
          role="status"
          className="mt-1.5 wrap-break-word text-xs text-emerald-600"
        >
          {state.success}
        </p>
      )}
    </form>
  );
}
