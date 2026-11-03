"use client";

import { useActionState } from "react";

import { confirmOpenAiAccessAction } from "@/actions/n8n-requests";
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

  return (
    <form action={action} className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-800">
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <input type="hidden" name="requestId" value={requestId} />
      <label className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-300">
        <input type="checkbox" name="confirmed" value="yes" required className="mt-0.5 accent-cyan-600" />
        I added this exact email in OpenAI.
      </label>
      {state.error && <p role="alert" className="mt-2 text-xs text-red-600">{state.error}</p>}
      {state.success && <p role="status" className="mt-2 text-sm text-emerald-600">{state.success}</p>}
      <div className="mt-2 max-w-xs">
        {requiresReauth || state.errorCode === "REAUTH_REQUIRED" ? (
          <GoogleReverifyButton />
        ) : (
          <PendingSubmitButton label="Confirm invite & email student" pendingLabel="Confirming…" className="w-auto px-3 py-2 text-xs" />
        )}
      </div>
    </form>
  );
}
